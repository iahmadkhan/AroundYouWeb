import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../src/context/AuthContext';
import { getMerchantShops, deleteShop, type MerchantShop } from '../../../../src/services/merchant/shopService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Store, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUtils';
import CreateShopScreen from './CreateShopScreen';
import EditShopScreen from './EditShopScreen';
import ViewShopScreen from './ViewShopScreen';

interface MerchantShopsScreenProps {
  onShopSelect?: (shopId: string) => void;
}

export default function MerchantShopsScreen({ onShopSelect }: MerchantShopsScreenProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState<MerchantShop | null>(null);
  const [shopToDelete, setShopToDelete] = useState<MerchantShop | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Check if we're coming from a route navigation
  useEffect(() => {
    const path = location.pathname;
    if (path === '/createshop') {
      setShowCreateModal(true);
      // Replace URL to keep shops list in background
      window.history.replaceState({}, '', '/merchantdashboard');
    } else if (path === '/editshop' && location.state?.shop) {
      setSelectedShop(location.state.shop);
      setShowEditModal(true);
      window.history.replaceState({}, '', '/merchantdashboard');
    } else if (path === '/viewshop' && location.state?.shop) {
      setSelectedShop(location.state.shop);
      setShowViewModal(true);
      window.history.replaceState({}, '', '/merchantdashboard');
    }
  }, [location]);

  const loadShops = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { shops: fetchedShops, error: fetchError } = await getMerchantShops(user.id);
      if (fetchError) {
        console.error('Error loading shops:', fetchError);
        setError(fetchError.message || 'Failed to load shops');
        setShops([]);
      } else {
        setShops(fetchedShops || []);
      }
    } catch (err: any) {
      console.error('Error loading shops:', err);
      setError(err.message || 'Failed to load shops');
      setShops([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShops();
  };

  const handleCreateShop = () => {
    setShowCreateModal(true);
  };

  const handleShopPress = (shop: MerchantShop) => {
    if (onShopSelect) {
      onShopSelect(shop.id);
    } else {
      // Fallback to old navigation if no onShopSelect prop
      navigate('/merchantshopportal', { state: { shop } });
    }
  };

  const handleViewShop = (shop: MerchantShop) => {
    setSelectedShop(shop);
    setShowViewModal(true);
  };

  const handleEditShop = (shop: MerchantShop) => {
    setSelectedShop(shop);
    setShowEditModal(true);
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowViewModal(false);
    setSelectedShop(null);
    // Navigate back to shops list
    navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } });
  };

  const handleDeleteShop = (shop: MerchantShop) => {
    setShopToDelete(shop);
    setConfirmText('');
    setDeleteError(null);
  };

  const handleCancelDelete = () => {
    setShopToDelete(null);
    setConfirmText('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!shopToDelete) return;

    // Require typing the shop name for confirmation
    if (confirmText.trim() !== shopToDelete.name.trim()) {
      setDeleteError('Please type the shop name exactly to confirm deletion');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { success, error } = await deleteShop(shopToDelete.id);
      if (error) {
        setDeleteError(error.message || 'Failed to delete shop');
        setIsDeleting(false);
        return;
      }
      if (success) {
        setShopToDelete(null);
        setConfirmText('');
        setDeleteError(null);
        loadShops(); // Reload shops list
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete shop');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Action Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Shops</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your shops and track performance</p>
        </div>
        <button
          onClick={handleCreateShop}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus size={20} />
          <span>Create Shop</span>
        </button>
      </div>

      {/* Content Section */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <LoadingSpinner text="Loading your shops..." />
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-red-600 text-center font-semibold mb-4 text-lg">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : shops.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          <div className="flex flex-col items-center justify-center py-12">
            {/* Large Icon */}
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-6">
              <Store size={40} className="text-blue-600" />
            </div>

            {/* Empty State Text */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              No shops yet
            </h2>
            <p className="text-gray-500 text-center mb-8 max-w-md">
              Create your first shop and start selling online to customers around you
            </p>

            {/* Create Shop Button */}
            <button
              className="px-8 py-3.5 bg-blue-600 rounded-xl text-white font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              onClick={handleCreateShop}
            >
              Create Your First Shop
            </button>
          </div>
        </div>
      ) : (
        /* Shops Table - SPM Design */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-1 font-semibold text-gray-900">Image</div>
              <div className="col-span-3 font-semibold text-gray-900">Shop Name</div>
              <div className="col-span-2 font-semibold text-gray-900">Status</div>
              <div className="col-span-2 font-semibold text-gray-900">Location</div>
              <div className="col-span-2 font-semibold text-gray-900">Created</div>
              <div className="col-span-2 font-semibold text-gray-900">Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {shops.map((shop) => {
              const shopImageUrl = shop.image_url ? getImageUrl(shop.image_url) : null;
              
              return (
                <div
                  key={shop.id}
                  className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Image */}
                  <div className="col-span-1">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                      {shopImageUrl ? (
                        <img 
                          src={shopImageUrl} 
                          alt={shop.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const placeholder = document.createElement('span');
                              placeholder.className = 'text-gray-400';
                              placeholder.textContent = '🏪';
                              if (!parent.querySelector('span')) {
                                parent.appendChild(placeholder);
                              }
                            }
                          }}
                        />
                      ) : (
                        <Store size={20} className="text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Shop Name */}
                  <div className="col-span-3">
                    <p className="font-medium text-gray-900">{shop.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{shop.description || 'No description'}</p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      shop.is_open 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shop.is_open ? 'Open' : 'Closed'}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="col-span-2">
                    <p className="text-sm text-gray-700 truncate">
                      {shop.address || 'No address'}
                    </p>
                  </div>

                  {/* Created Date */}
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">
                      {formatDate(shop.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center gap-2">
                    <button
                      onClick={() => handleViewShop(shop)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEditShop(shop)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteShop(shop)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Shop Modal */}
      {showCreateModal && (
        <CreateShopScreen
          onClose={() => {
            setShowCreateModal(false);
            loadShops(); // Refresh shops list
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            loadShops(); // Refresh shops list
          }}
        />
      )}

      {/* Edit Shop Modal */}
      {showEditModal && selectedShop && (
        <EditShopScreen
          shop={selectedShop}
          onClose={() => {
            setShowEditModal(false);
            setSelectedShop(null);
            loadShops(); // Refresh shops list
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedShop(null);
            loadShops(); // Refresh shops list
          }}
        />
      )}

      {/* View Shop Modal */}
      {showViewModal && selectedShop && (
        <ViewShopScreen
          shop={selectedShop}
          onClose={() => {
            setShowViewModal(false);
            setSelectedShop(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {shopToDelete && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
            onClick={handleCancelDelete}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Warning Icon */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Trash2 size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">Delete Shop</h3>
                    <p className="text-red-100 text-sm mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                {/* Warning Message */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="text-red-600 text-xl flex-shrink-0 mt-0.5">⚠️</div>
                    <div className="flex-1">
                      <p className="text-red-900 font-semibold text-sm mb-2">
                        Warning: Deleting this shop will permanently remove:
                      </p>
                      <ul className="text-red-800 text-sm space-y-1.5 list-disc list-inside">
                        <li>All shop inventory and products</li>
                        <li>All shop orders and order history</li>
                        <li>All shop settings and configurations</li>
                        <li>All delivery areas and logic</li>
                        <li>All shop analytics and data</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Shop Info */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-gray-600 text-sm mb-2">You are about to delete:</p>
                  <p className="text-gray-900 font-bold text-lg">{shopToDelete.name}</p>
                  {shopToDelete.address && (
                    <p className="text-gray-600 text-sm mt-1">{shopToDelete.address}</p>
                  )}
                </div>

                {/* Confirmation Input */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Type <span className="text-red-600 font-bold">"{shopToDelete.name}"</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => {
                      setConfirmText(e.target.value);
                      setDeleteError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && confirmText.trim() === shopToDelete.name.trim() && !isDeleting) {
                        handleConfirmDelete();
                      }
                    }}
                    placeholder={shopToDelete.name}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                    disabled={isDeleting}
                    autoFocus
                  />
                  {deleteError && (
                    <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>{deleteError}</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting || confirmText.trim() !== shopToDelete.name.trim()}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        <span>Delete Shop</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
