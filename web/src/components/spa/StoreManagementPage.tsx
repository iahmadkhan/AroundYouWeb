import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Camera, 
  Edit, 
  Trash2,
  Plus
} from 'lucide-react';
import { supabase } from '../../../../src/services/supabase';
import { deleteInventoryItem, toggleInventoryItemActive, updateInventoryItem } from '../../../../src/services/merchant/inventoryService';
import { useInventoryItems } from '../../../../src/hooks/merchant/useInventoryItems';
import { useInventoryCategories } from '../../../../src/hooks/merchant/useInventoryCategories';
import { useQueryClient } from 'react-query';
import AddItemModal from '../AddItemModal';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  currency?: string;
  image?: string;
  isActive: boolean;
}

interface StoreManagementPageProps {
  shopId?: string;
  products?: Product[];
  onProductEdit?: (product: Product) => void;
  onProductDelete?: (productId: string) => void;
  onProductToggleActive?: (productId: string, isActive: boolean) => void;
  onBulkAction?: (action: string, productIds: string[]) => void;
}

// Dummy sample data
const dummyProducts: Product[] = [
  {
    id: '1',
    name: "Aunt Mabel's Red Velvet (White Chocolate Core) Muffin 70g",
    sku: 'RU9351',
    barcode: '7071864007835',
    category: 'Sticks',
    price: 11,
    currency: 'SGD',
    isActive: true,
  },
  {
    id: '2',
    name: "Premium Coffee Beans 500g",
    sku: 'CB2847',
    barcode: '1234567890123',
    category: 'Spirits',
    price: 25,
    currency: 'SGD',
    isActive: true,
  },
  {
    id: '3',
    name: "Organic Honey 250ml",
    sku: 'HN4521',
    barcode: '9876543210987',
    category: 'Sticks',
    price: 8,
    currency: 'SGD',
    isActive: false,
  },
];

export default function StoreManagementPage({
  shopId,
  products: propProducts,
  onProductEdit,
  onProductDelete,
  onProductToggleActive,
  onBulkAction,
}: StoreManagementPageProps) {
  const [products, setProducts] = useState<Product[]>(propProducts || dummyProducts);
  const [loading, setLoading] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    sku: '',
    price: '',
    description: '',
    isActive: true,
  });
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Use React Query hook for inventory items with caching - increased limit
  const inventoryParams = useMemo(() => ({
    limit: 500, // Increased from 100 to 500 for better performance
    active: undefined, // Get all items
  }), []);

  const { data: inventoryData, isLoading: inventoryLoading, refetch: refetchInventory } = useInventoryItems(
    shopId || '',
    inventoryParams
  );
  
  // Load categories separately for better performance
  const { data: categoriesData = [] } = useInventoryCategories(shopId || '');

  // Transform inventory items to Product format when data changes
  useEffect(() => {
    if (propProducts) {
      setProducts(propProducts);
    } else if (inventoryData?.items) {
      // Create a map of category IDs to names for faster lookup
      const categoryMap = new Map(categoriesData.map(cat => [cat.id, cat.name]));
      
      const transformedProducts: Product[] = inventoryData.items.map((item) => {
        // Get first category name from item categories or category map
        let categoryName = 'Uncategorized';
        if (item.categories && item.categories.length > 0) {
          categoryName = item.categories[0].name || categoryMap.get(item.categories[0].id) || 'Uncategorized';
        } else if (item.categoryIds && item.categoryIds.length > 0) {
          // Fallback to categoryIds if categories array is not populated
          const catId = item.categoryIds[0];
          categoryName = (catId && categoryMap.get(catId)) || 'Uncategorized';
        }

        return {
          id: item.id,
          name: item.name || 'Unnamed Item',
          sku: item.sku || '',
          barcode: item.barcode || '',
          category: categoryName,
          price: item.priceCents / 100,
          currency: item.currency || 'PKR',
          image: item.imageUrl || '',
          isActive: item.isActive !== false,
        };
      });
      setProducts(transformedProducts);
    }
  }, [inventoryData, propProducts]);

  // Update loading state
  useEffect(() => {
    setLoading(inventoryLoading);
  }, [inventoryLoading]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(products.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product);
    setEditError(null);
    
    // Load full product data including description
    try {
      const { data, error } = await supabase
        .from('merchant_items')
        .select('description, sku, price_cents, is_active')
        .eq('id', product.id)
        .maybeSingle();

      if (!error && data) {
        const itemData = data as { sku: string | null; price_cents: number | null; description: string | null; is_active: boolean | null };
        setEditFormData({
          sku: itemData.sku || product.sku || '',
          price: ((itemData.price_cents || 0) / 100).toString(),
          description: itemData.description || '',
          isActive: itemData.is_active !== false,
        });
      } else {
        // Fallback to product data if fetch fails
        setEditFormData({
          sku: product.sku || '',
          price: product.price.toString(),
          description: '',
          isActive: product.isActive,
        });
      }
    } catch (err) {
      // Fallback to product data if fetch fails
      setEditFormData({
        sku: product.sku || '',
        price: product.price.toString(),
        description: '',
        isActive: product.isActive,
      });
    }
    
    setShowEditModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    setEditError(null);

    if (!editFormData.sku.trim() && editFormData.isActive) {
      setEditError('SKU is required for active items');
      return;
    }

    if (!editFormData.price || parseFloat(editFormData.price) < 0) {
      setEditError('Valid price is required');
      return;
    }

    setUpdatingProductId(editingProduct.id);
    try {
      const priceCents = Math.round(parseFloat(editFormData.price) * 100);
      const { data, error } = await updateInventoryItem(editingProduct.id, {
        sku: editFormData.sku.trim() || undefined,
        priceCents,
        description: editFormData.description.trim() || undefined,
        isActive: editFormData.isActive,
      });

      if (error) {
        console.error('Error updating item:', error);
        setEditError(error.message || 'Failed to update item');
        setUpdatingProductId(null);
        return;
      }

      // Invalidate and refetch inventory cache
      queryClient.invalidateQueries({ queryKey: ['inventory', shopId] });
      await refetchInventory();

      setShowEditModal(false);
      setEditingProduct(null);
      setEditError(null);
    } catch (error: any) {
      console.error('Error updating item:', error);
      setEditError(error.message || 'Failed to update item');
    } finally {
      setUpdatingProductId(null);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    setDeletingProductId(productToDelete.id);
    setDeleteError(null);
    try {
      const { data, error } = await deleteInventoryItem(productToDelete.id);
      
      if (error) {
        console.error('Error deleting item:', error);
        setDeleteError(error.message || 'Failed to delete item. Please try again.');
        setDeletingProductId(null);
        return;
      }

      // Invalidate cache and refetch
      queryClient.invalidateQueries({ queryKey: ['inventory', shopId] });
      await refetchInventory();
      
      // Remove from local state
      setProducts(products.filter(p => p.id !== productToDelete.id));
      setSelectedProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(productToDelete.id);
        return newSet;
      });

      // Close modal on success
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error: any) {
      console.error('Error deleting item:', error);
      setDeleteError(error.message || 'Failed to delete item. Please try again.');
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    try {
      const { data, error } = await toggleInventoryItemActive(productId, !isActive);

      if (error) {
        console.error('Error toggling item active status:', error);
        alert(`Failed to update item: ${error.message || 'Unknown error'}`);
        return;
      }

      // Invalidate cache and refetch
      queryClient.invalidateQueries({ queryKey: ['inventory', shopId] });
      await refetchInventory();
      
      // Update local state
      setProducts(products.map(p => 
        p.id === productId ? { ...p, isActive: !isActive } : p
      ));

      if (onProductToggleActive) {
        onProductToggleActive(productId, !isActive);
      }
    } catch (error: any) {
      console.error('Error toggling item active status:', error);
      alert(`Failed to update item: ${error.message || 'Unknown error'}`);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inventory...</p>
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
              placeholder="Search by Product, SKU & Barcode"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors">
              <Camera size={20} />
            </button>
          </div>

          {/* Add Item Button on the Right */}
          {shopId && (
              <button
              onClick={() => setShowAddItemModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
              >
              <Plus size={18} />
              <span>Add Item</span>
                      </button>
          )}
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
            </div>
            <div className="col-span-4 font-semibold text-gray-900">Product</div>
            <div className="col-span-2 font-semibold text-gray-900">Barcodes</div>
            <div className="col-span-2 font-semibold text-gray-900">Category</div>
            <div className="col-span-1 font-semibold text-gray-900">Price</div>
            <div className="col-span-1 font-semibold text-gray-900">Active?</div>
            <div className="col-span-1 font-semibold text-gray-900">Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-100">
          {filteredProducts.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No products found. Try adjusting your filters.
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                {/* Checkbox */}
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>

                {/* Product */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {product.image ? (
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const placeholder = document.createElement('span');
                            placeholder.className = 'text-gray-400 text-xs';
                            placeholder.textContent = '📦';
                            if (!parent.querySelector('span')) {
                              parent.appendChild(placeholder);
                            }
                          }
                        }}
                        onLoad={() => {
                          console.log('Product image loaded:', product.image);
                        }}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">📦</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">SKU: {product.sku}</p>
                  </div>
                </div>

                {/* Barcode */}
                <div className="col-span-2">
                  <p className="text-sm text-gray-700 font-mono">{product.barcode}</p>
                </div>

                {/* Category */}
                <div className="col-span-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    {product.category}
                  </span>
                </div>

                {/* Price */}
                <div className="col-span-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {product.currency || 'SGD'} {product.price}
                  </p>
                </div>

                {/* Active Toggle */}
                <div className="col-span-1">
                  <button
                    onClick={() => handleToggleActive(product.id, product.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      product.isActive ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        product.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center gap-2">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    disabled={deletingProductId === product.id}
                    className={`p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                      deletingProductId === product.id ? 'opacity-50 cursor-not-allowed' : ''
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

      {/* Add Item Modal */}
      {shopId && (
        <AddItemModal
          shopId={shopId}
          isOpen={showAddItemModal}
          onClose={() => {
            setShowAddItemModal(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['inventory', shopId] });
            refetchInventory(); // Reload inventory after adding item
            setShowAddItemModal(false);
            setEditingProduct(null);
          }}
        />
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Edit Item</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Item Name</p>
                <p className="text-base font-semibold text-gray-900">{editingProduct.name}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU {editFormData.isActive && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Enter SKU"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    rows={3}
                    placeholder="Enter description"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.isActive}
                      onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              {editError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProduct}
                  disabled={updatingProductId === editingProduct.id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingProductId === editingProduct.id ? 'Updating...' : 'Update Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Delete Item</h2>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setProductToDelete(null);
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
                <p className="text-sm text-gray-600 mb-2">Are you sure you want to delete this item?</p>
                <p className="text-base font-semibold text-gray-900">{productToDelete.name}</p>
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
                    setProductToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={deletingProductId === productToDelete.id}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteProduct}
                  disabled={deletingProductId === productToDelete.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingProductId === productToDelete.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </span>
                  ) : (
                    'Delete Item'
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

