import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, Phone, User } from 'lucide-react';
import { supabase } from '../../../../src/services/supabase';
import { useQuery, useQueryClient } from 'react-query';
import { fetchDeliveryRunners } from '../../../../src/services/merchant/deliveryRunnerService';

interface DeliveryRunner {
  id: string;
  shop_id: string;
  name: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
}

interface DeliveryRunnersPageProps {
  shopId?: string;
}

export default function DeliveryRunnersPage({ shopId }: DeliveryRunnersPageProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRunner, setEditingRunner] = useState<DeliveryRunner | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [runnerToDelete, setRunnerToDelete] = useState<DeliveryRunner | null>(null);
  const [deletingRunnerId, setDeletingRunnerId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use React Query for fast, cached loading with timeout protection
  const { data: runners = [], isLoading: loading, refetch: refetchRunners, error: queryError } = useQuery(
    ['delivery-runners', shopId],
    async (): Promise<DeliveryRunner[]> => {
      if (!shopId) return [];
      
      // Direct query with minimal fields and aggressive timeout
      // Skip service layer to avoid extra overhead
      const queryPromise = supabase
        .from('delivery_runners')
        .select('id, shop_id, name, phone_number, created_at, updated_at')
        .eq('shop_id', shopId)
        .limit(50); // Small limit for speed

      const timeoutPromise = new Promise<{ data: DeliveryRunner[]; error: null }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: [],
            error: null,
          });
        }, 1500); // Very short 1.5 second timeout - fail fast
      });

      const result: any = await Promise.race([queryPromise, timeoutPromise]);
      
      if (result.error && result.error.code !== 'TIMEOUT') {
        console.error('[DeliveryRunnersPage] Query error:', result.error);
        // On error, return empty array rather than throwing
        return [];
      }

      const runnersData = (result.data || []) as DeliveryRunner[];
      // Sort in memory by created_at (newest first)
      return runnersData.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    {
      enabled: !!shopId,
      staleTime: 60000, // Cache for 60 seconds (longer cache for stability)
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      retry: 0, // Don't retry on failure - just use cache if available
      refetchOnWindowFocus: false, // Don't refetch on window focus to avoid timeouts
      refetchOnReconnect: false, // Don't refetch on reconnect
    }
  );

  const handleAddRunner = () => {
    setFormData({ name: '', phoneNumber: '' });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleEditRunner = (runner: DeliveryRunner) => {
    setEditingRunner(runner);
    setFormData({
      name: runner.name,
      phoneNumber: runner.phone_number,
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const handleDeleteRunner = (runner: DeliveryRunner) => {
    setRunnerToDelete(runner);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const confirmDeleteRunner = async () => {
    if (!runnerToDelete || !shopId) return;

    setDeletingRunnerId(runnerToDelete.id);
    setDeleteError(null);
    try {
      const { error } = await supabase
        .from('delivery_runners')
        .delete()
        .eq('id', runnerToDelete.id)
        .eq('shop_id', shopId);

      if (error) {
        throw error;
      }

      // Invalidate and refetch to update the list
      queryClient.invalidateQueries({ queryKey: ['delivery-runners', shopId] });
      await refetchRunners();
      setShowDeleteModal(false);
      setRunnerToDelete(null);
    } catch (error: any) {
      console.error('Error deleting runner:', error);
      setDeleteError(error.message || 'Failed to delete runner. Please try again.');
    } finally {
      setDeletingRunnerId(null);
    }
  };

  const handleSubmitRunner = async () => {
    if (!shopId) return;

    if (!formData.name.trim()) {
      setFormError('Runner name is required');
      return;
    }

    if (!formData.phoneNumber.trim()) {
      setFormError('Phone number is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingRunner) {
        // Update existing runner
        const updateData: any = {
          name: formData.name.trim(),
          phone_number: formData.phoneNumber.trim(),
        };
        const { error: updateError } = await (supabase
          .from('delivery_runners') as any)
          .update(updateData)
          .eq('id', editingRunner.id)
          .eq('shop_id', shopId);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new runner
        const insertData: any = {
          shop_id: shopId,
          name: formData.name.trim(),
          phone_number: formData.phoneNumber.trim(),
        };
        const { error: createError } = await (supabase
          .from('delivery_runners') as any)
          .insert(insertData);

        if (createError) {
          throw createError;
        }
      }

      // Invalidate and refetch to update the list
      queryClient.invalidateQueries({ queryKey: ['delivery-runners', shopId] });
      await refetchRunners();
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingRunner(null);
      setFormData({ name: '', phoneNumber: '' });
    } catch (error: any) {
      console.error('Error saving runner:', error);
      setFormError(error.message || 'Failed to save runner. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoize filtered runners for performance
  const filteredRunners = useMemo(() => {
    if (!searchQuery.trim()) return runners;
    
    const query = searchQuery.toLowerCase();
    return runners.filter(runner => 
      runner.name.toLowerCase().includes(query) ||
      runner.phone_number.includes(searchQuery)
    );
  }, [runners, searchQuery]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Show loading only on initial load when we have no data
  // If we have cached data, show it even while refetching
  const isInitialLoad = loading && runners.length === 0;
  
  if (isInitialLoad) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading delivery runners...</p>
          {queryError && (
            <p className="text-sm text-orange-600 mt-2">
              {queryError instanceof Error ? queryError.message : 'Using cached data or retrying...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Warning banner if query timed out */}
      {queryError && runners.length === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <p className="text-orange-800 text-sm">
            <strong>Note:</strong> Loading runners is taking longer than expected. 
            {runners.length === 0 ? ' Please check your connection or try refreshing the page.' : ' Showing cached data.'}
          </p>
        </div>
      )}
      
      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {shopId && (
            <button
              onClick={handleAddRunner}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus size={20} />
              <span>Add Runner</span>
            </button>
          )}
        </div>
      </div>

      {/* Runners Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-4 font-semibold text-gray-900">Name</div>
            <div className="col-span-4 font-semibold text-gray-900">Phone Number</div>
            <div className="col-span-2 font-semibold text-gray-900">Added</div>
            <div className="col-span-2 font-semibold text-gray-900">Actions</div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredRunners.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {searchQuery ? 'No runners found matching your search.' : 'No delivery runners yet. Add your first runner to get started.'}
            </div>
          ) : (
            filteredRunners.map((runner) => (
              <div
                key={runner.id}
                className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <p className="font-medium text-gray-900">{runner.name}</p>
                </div>

                <div className="col-span-4 flex items-center gap-2">
                  <Phone size={16} className="text-gray-400" />
                  <p className="text-sm text-gray-700">{runner.phone_number}</p>
                </div>

                <div className="col-span-2">
                  <p className="text-sm text-gray-600">{formatDate(runner.created_at)}</p>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={() => handleEditRunner(runner)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteRunner(runner)}
                    disabled={deletingRunnerId === runner.id}
                    className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                      deletingRunnerId === runner.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Runner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Add Delivery Runner</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({ name: '', phoneNumber: '' });
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitRunner(); }} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm">{formError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., +92 300 1234567"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: '', phoneNumber: '' });
                    setFormError(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Add Runner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Runner Modal */}
      {showEditModal && editingRunner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Edit Delivery Runner</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRunner(null);
                  setFormData({ name: '', phoneNumber: '' });
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitRunner(); }} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm">{formError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., +92 300 1234567"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRunner(null);
                    setFormData({ name: '', phoneNumber: '' });
                    setFormError(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Updating...' : 'Update Runner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && runnerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Delete Runner</h2>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setRunnerToDelete(null);
                    setDeleteError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Are you sure you want to delete this runner?</p>
                <p className="text-base font-semibold text-gray-900">{runnerToDelete.name}</p>
                <p className="text-sm text-gray-600 mt-1">{runnerToDelete.phone_number}</p>
                <p className="text-sm text-red-600 mt-2">This action cannot be undone.</p>
              </div>

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setRunnerToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={deletingRunnerId === runnerToDelete.id}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRunner}
                  disabled={deletingRunnerId === runnerToDelete.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingRunnerId === runnerToDelete.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </span>
                  ) : (
                    'Delete Runner'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

