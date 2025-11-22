import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { supabase } from '../../../../src/services/supabase';
import { useInventoryCategories, useCreateInventoryCategory, useUpdateInventoryCategory, useDeleteInventoryCategory } from '../../../../src/hooks/merchant/useInventoryCategories';
import { useQueryClient } from 'react-query';

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_custom: boolean;
  item_count: number;
  created_at: string;
}

interface CategoriesManagementPageProps {
  shopId?: string;
}

export default function CategoriesManagementPage({ shopId }: CategoriesManagementPageProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateCategories, setTemplateCategories] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // Use React Query hook for categories with caching
  const { data: categoriesData = [], isLoading: loading, refetch: refetchCategories } = useInventoryCategories(shopId || '');
  const createCategoryMutation = useCreateInventoryCategory(shopId || '');
  const updateCategoryMutation = useUpdateInventoryCategory(shopId || '');
  const deleteCategoryMutation = useDeleteInventoryCategory(shopId || '');

  // Transform categories data
  const categories: Category[] = categoriesData.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description || null,
    is_active: cat.isActive !== false,
    is_custom: cat.isCustom !== false,
    item_count: cat.itemCount || 0,
    created_at: cat.createdAt,
  }));

  const handleAddCategory = () => {
    setFormData({ name: '', description: '' });
    setFormError(null);
    setShowCustomForm(false);
    setShowAddModal(true);
  };

  const handleCreateCustom = () => {
    setFormData({ name: '', description: '' });
    setFormError(null);
    setShowCustomForm(true);
  };

  const handleAddFromTemplate = async () => {
    setShowAddModal(false);
    setTemplateSearch('');
    setFormError(null);
    setLoadingTemplates(true);
    setShowTemplatePicker(true);
    
    try {
      const { data, error } = await supabase
        .from('category_templates')
        .select('*')
        .order('name', { ascending: true });

      console.log('Template categories query result:', { data, error });

      if (error) {
        console.error('Error loading template categories:', error);
        setFormError(error.message || 'Failed to load template categories. Please try again.');
        setTemplateCategories([]);
      } else {
        console.log('Loaded template categories:', data);
        setTemplateCategories(data || []);
        if (!data || data.length === 0) {
          setFormError('No template categories available. Please create a custom category instead.');
        } else {
          setFormError(null); // Clear any previous errors if we have templates
        }
      }
    } catch (error: any) {
      console.error('Error loading template categories:', error);
      setFormError(error.message || 'Failed to load template categories. Please try again.');
      setTemplateCategories([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = async (template: any) => {
    if (!shopId) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Check if category with this template already exists
      const { data: existing } = await supabase
        .from('merchant_categories')
        .select('id')
        .eq('shop_id', shopId)
        .eq('template_id', template.id)
        .maybeSingle();

      if (existing) {
        setFormError('A category from this template already exists in your shop.');
        setIsSubmitting(false);
        return;
      }

      // Create category from template
      const insertData: any = {
        shop_id: shopId,
        template_id: template.id,
        name: template.name,
        description: template.description || null,
        is_custom: false,
        is_active: true,
      };
      const { error: createError } = await (supabase
        .from('merchant_categories') as any)
        .insert(insertData);

      if (createError) {
        throw createError;
      }

      // Invalidate cache and refetch
      queryClient.invalidateQueries({ queryKey: ['inventory', shopId, 'categories'] });
      await refetchCategories();
      setShowTemplatePicker(false);
      setTemplateSearch('');
    } catch (error: any) {
      console.error('Error creating category from template:', error);
      setFormError(error.message || 'Failed to add category from template. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete || !shopId) return;

    setDeletingCategoryId(categoryToDelete.id);
    setDeleteError(null);
    try {
      // First, check if category has items
      const { data: itemsData, error: itemsError } = await supabase
        .from('merchant_item_categories')
        .select('merchant_item_id')
        .eq('merchant_category_id', categoryToDelete.id)
        .limit(1);

      if (itemsError) {
        throw itemsError;
      }

      if (itemsData && itemsData.length > 0) {
        setDeleteError('Cannot delete category with items. Please remove items from this category first.');
        setDeletingCategoryId(null);
        return;
      }

      // Delete the category using mutation
      await deleteCategoryMutation.mutateAsync(categoryToDelete.id);

      // Mutation automatically invalidates cache, but we can refetch for immediate update
      await refetchCategories();
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    } catch (error: any) {
      console.error('Error deleting category:', error);
      setDeleteError(error.message || 'Failed to delete category. Please try again.');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleSubmitCategory = async () => {
    if (!shopId) return;

    if (!formData.name.trim()) {
      setFormError('Category name is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingCategory) {
        // Update existing category using mutation
        await updateCategoryMutation.mutateAsync({
          categoryId: editingCategory.id,
          updates: {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          },
        });
      } else {
        // Create new category using mutation
        await createCategoryMutation.mutateAsync({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        });
      }

      // Mutations automatically invalidate cache, but we can refetch for immediate update
      await refetchCategories();
      setShowAddModal(false);
      setShowCustomForm(false);
      setShowEditModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    } catch (error: any) {
      console.error('Error saving category:', error);
      setFormError(error.message || 'Failed to save category. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = 
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by Category Name & Description"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Add Category Button */}
          {shopId && (
            <button
              onClick={handleAddCategory}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus size={20} />
              <span>Add New Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-3 font-semibold text-gray-900">Category Name</div>
            <div className="col-span-4 font-semibold text-gray-900">Description</div>
            <div className="col-span-1 font-semibold text-gray-900">Items</div>
            <div className="col-span-2 font-semibold text-gray-900">Type</div>
            <div className="col-span-1 font-semibold text-gray-900">Status</div>
            <div className="col-span-1 font-semibold text-gray-900">Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-100">
          {filteredCategories.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {searchQuery ? 'No categories found matching your search.' : 'No categories yet. Create your first category to get started.'}
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div
                key={category.id}
                className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                {/* Category Name */}
                <div className="col-span-3">
                  <p className="font-medium text-gray-900">{category.name}</p>
                </div>

                {/* Description */}
                <div className="col-span-4">
                  <p className="text-sm text-gray-700 truncate">
                    {category.description || 'No description'}
                  </p>
                </div>

                {/* Item Count */}
                <div className="col-span-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {category.item_count}
                  </span>
                </div>

                {/* Type */}
                <div className="col-span-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    category.is_custom
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {category.is_custom ? 'Custom' : 'Template'}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-1">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    category.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {category.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center gap-2">
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    disabled={deletingCategoryId === category.id}
                    className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                      deletingCategoryId === category.id ? 'opacity-50 cursor-not-allowed' : ''
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

      {/* Add Category Choice Modal */}
      {showAddModal && !showCustomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Add New Category</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowCustomForm(false);
                  setFormData({ name: '', description: '' });
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                <button
                  onClick={handleCreateCustom}
                  className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all text-left flex items-center justify-between"
                >
                  <span>Create Custom Category</span>
                  <span>→</span>
                </button>
                <button
                  onClick={handleAddFromTemplate}
                  className="w-full px-6 py-4 bg-white border-2 border-blue-600 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all text-left flex items-center justify-between"
                >
                  <span>Add from Template</span>
                  <span>→</span>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-4 text-center">
                Choose to create a custom category or select from pre-defined templates
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Category Form Modal */}
      {showAddModal && showCustomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Create Custom Category</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowCustomForm(false);
                  setFormData({ name: '', description: '' });
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitCategory(); }} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm">{formError}</p>
                </div>
              )}

              {/* Category Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Fresh Produce"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Description <span className="text-gray-500 font-normal text-xs">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this category..."
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowCustomForm(false);
                    setFormData({ name: '', description: '' });
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
                  {isSubmitting ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Edit Category</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCategory(null);
                  setFormData({ name: '', description: '' });
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitCategory(); }} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm">{formError}</p>
                </div>
              )}

              {/* Category Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Fresh Produce"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Description <span className="text-gray-500 font-normal text-xs">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this category..."
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCategory(null);
                    setFormData({ name: '', description: '' });
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
                  {isSubmitting ? 'Updating...' : 'Update Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Delete Category</h2>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCategoryToDelete(null);
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
                <p className="text-sm text-gray-600 mb-2">Are you sure you want to delete this category?</p>
                <p className="text-base font-semibold text-gray-900">{categoryToDelete.name}</p>
                {categoryToDelete.item_count > 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    This category has {categoryToDelete.item_count} item(s). You must remove all items before deleting.
                  </p>
                )}
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
                    setCategoryToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={deletingCategoryId === categoryToDelete.id}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteCategory}
                  disabled={deletingCategoryId === categoryToDelete.id || categoryToDelete.item_count > 0}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingCategoryId === categoryToDelete.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </span>
                  ) : (
                    'Delete Category'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Select Category Template</h2>
              <button
                onClick={() => {
                  setShowTemplatePicker(false);
                  setTemplateSearch('');
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm">{formError}</p>
                </div>
              )}

              {/* Template List */}
              {loadingTemplates ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600 text-sm">Loading templates...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templateCategories
                    .filter((template: any) => 
                      !templateSearch || 
                      template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      (template.description && template.description.toLowerCase().includes(templateSearch.toLowerCase()))
                    )
                    .map((template: any) => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        disabled={isSubmitting}
                        className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                            {template.description && (
                              <p className="text-sm text-gray-600">{template.description}</p>
                            )}
                          </div>
                          {isSubmitting && (
                            <div className="ml-4">
                              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  
                  {templateCategories.filter((template: any) => 
                    !templateSearch || 
                    template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                    (template.description && template.description.toLowerCase().includes(templateSearch.toLowerCase()))
                  ).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      {templateSearch ? 'No templates found matching your search.' : 'No template categories available.'}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowTemplatePicker(false);
                  setTemplateSearch('');
                  setFormError(null);
                }}
                className="w-full px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

