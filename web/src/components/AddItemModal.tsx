import React, { useState, useEffect } from 'react';
import { supabase } from '../../../src/services/supabase';
import { useInventoryTemplates } from '../../../src/hooks/merchant/useInventoryTemplates';
import { getImageUrl } from '../utils/imageUtils';

interface AddItemModalProps {
  shopId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Category {
  id: string;
  name: string;
}

export default function AddItemModal({ shopId, isOpen, onClose, onSuccess }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [existingTemplateIds, setExistingTemplateIds] = useState<Set<string>>(new Set());
  
  const { data: templates, isLoading: templatesLoading } = useInventoryTemplates(templateSearch);

  useEffect(() => {
    if (isOpen && shopId) {
      loadCategories();
      loadExistingTemplateIds();
      // Reset form when modal opens
      if (!selectedTemplate) {
        resetForm();
      }
    }
  }, [isOpen, shopId]);

  useEffect(() => {
    if (!isOpen) {
      setShowTemplatePicker(false);
      setTemplateSearch('');
      setSelectedTemplate(null);
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('merchant_categories')
        .select('id, name')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    }
  };

  const loadExistingTemplateIds = async () => {
    try {
      const { data, error } = await supabase
        .from('merchant_items')
        .select('template_id')
        .eq('shop_id', shopId)
        .not('template_id', 'is', null);

      if (error) throw error;
      const ids = new Set((data || []).map(item => item.template_id).filter(Boolean));
      setExistingTemplateIds(ids);
    } catch (err: any) {
      console.error('Error loading existing template IDs:', err);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSku('');
    setBarcode('');
    setPrice('');
    setImageUrl('');
    setImageFile(null);
    setImagePreview(null);
    setIsActive(true);
    setSelectedCategories([]);
    setSelectedTemplate(null);
    setError(null);
    setUploadingImage(false);
    setShowTemplatePicker(false);
    setTemplateSearch('');
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setName(template.name || '');
    setDescription(template.description || '');
    setBarcode(template.barcode || '');
    setImageUrl(template.imageUrl || '');
    setShowTemplatePicker(false);
    setTemplateSearch('');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      setImageFile(file);
      setImageUrl(''); // Clear URL if file is selected
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToStorage = async (file: File, itemId: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      
      // Check authentication first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Not authenticated for image upload:', sessionError);
        throw new Error('Not authenticated. Please log in again.');
      }

      // Generate unique filename with proper extension
      const mime = file.type || 'image/jpeg';
      let extension = 'jpg';
      if (mime.includes('avif')) extension = 'avif';
      else if (mime.includes('webp')) extension = 'webp';
      else if (mime.includes('png')) extension = 'png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
      else {
        const fileExt = file.name.split('.').pop();
        extension = fileExt || 'jpg';
      }
      
      const fileName = `${itemId}-${Date.now()}.${extension}`;
      // Path should be just the filename, bucket is specified in .from()
      const filePath = `${shopId}/${fileName}`;

      console.log('Uploading item image:', { filePath, mime, fileName, shopId });

      // Upload to Supabase Storage with timeout
      const uploadPromise = supabase.storage
        .from('item-images')
        .upload(filePath, file, {
          contentType: mime,
          upsert: false,
        });

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: { message: 'Upload timeout', code: 'TIMEOUT' } });
        }, 30000); // 30 second timeout for image upload
      });

      const { data: uploadData, error: uploadError } = await Promise.race([
        uploadPromise,
        timeoutPromise
      ]);

      if (uploadError) {
        console.error('Error uploading image:', {
          error: uploadError,
          message: uploadError.message,
          code: uploadError.code,
          filePath,
          fileName
        });
        
        if (uploadError.code === 'TIMEOUT') {
          throw new Error('Image upload is taking too long. Please try again with a smaller image.');
        }
        
        // Check for specific error types
        if (uploadError.message?.includes('duplicate') || uploadError.message?.includes('already exists')) {
          // Try with a different filename
          const retryFileName = `${itemId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
          const retryPath = `${shopId}/${retryFileName}`;
          const { data: retryData, error: retryError } = await supabase.storage
            .from('item-images')
            .upload(retryPath, file, {
              contentType: mime,
              upsert: false,
            });
          
          if (retryError) {
            throw retryError;
          }
          
          // Get public URL for retry
          const { data: urlData } = supabase.storage
            .from('item-images')
            .getPublicUrl(retryPath);
          return urlData.publicUrl;
        }
        
        throw uploadError;
      }

      if (!uploadData) {
        throw new Error('Upload failed - no data returned');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      console.log('✅ Image uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (err: any) {
      console.error('Error uploading image:', err);
      // Return more specific error message
      if (err.message) {
        throw new Error(err.message);
      }
      throw new Error('Failed to upload image. Please check your connection and try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    if (!price || parseFloat(price) < 0) {
      setError('Valid price is required');
      return;
    }

    // Validate that at least one category is selected
    if (selectedCategories.length === 0) {
      setError('Please select at least one category for this item');
      return;
    }

    setLoading(true);
    try {
      const priceCents = Math.round(parseFloat(price) * 100);

      // Auto-generate SKU if empty and item is active (required by database constraint)
      let finalSku = sku.trim();
      if (!finalSku && isActive) {
        // Generate SKU from item name or use a random identifier
        const nameSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20) || 'item';
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        finalSku = `${nameSlug}-${randomSuffix}`;
      }

      // Upload image first if a file is selected (before creating item)
      let finalImageUrl = imageUrl.trim() || null;
      if (imageFile) {
        try {
          // Generate a temporary ID for filename
          const tempId = crypto.randomUUID();
          const uploadedUrl = await uploadImageToStorage(imageFile, tempId);
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
          } else {
            setError('Failed to upload image. Please try again.');
            setLoading(false);
            return;
          }
        } catch (uploadErr: any) {
          console.error('Image upload error:', uploadErr);
          setError(uploadErr.message || 'Failed to upload image. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Insert item
      const { data: itemData, error: itemError } = await supabase
        .from('merchant_items')
        .insert({
          shop_id: shopId,
          template_id: selectedTemplate?.id || null,
          name: name.trim(),
          description: description.trim() || null,
          sku: finalSku || null,
          barcode: barcode.trim() || null,
          image_url: finalImageUrl,
          price_cents: priceCents,
          currency: 'PKR',
          is_active: isActive,
          is_custom: !selectedTemplate?.id,
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Link categories if selected
      if (selectedCategories.length > 0 && itemData) {
        const categoryLinks = selectedCategories.map((categoryId, index) => ({
          merchant_item_id: itemData.id,
          merchant_category_id: categoryId,
          sort_order: index,
        }));

        const { error: linkError } = await supabase
          .from('merchant_item_categories')
          .insert(categoryLinks);

        if (linkError) {
          console.error('Error linking categories:', linkError);
          // Don't fail the whole operation if category linking fails
        }
      }

      // Reset form
      resetForm();
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding item:', err);
      setError(err.message || 'Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Add New Item</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Add from Template (Optional)
            </label>
            {selectedTemplate ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedTemplate.imageUrl && (
                    <img 
                      src={getImageUrl(selectedTemplate.imageUrl) || ''} 
                      alt={selectedTemplate.name}
                      className="w-12 h-12 object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{selectedTemplate.name}</p>
                    {selectedTemplate.barcode && (
                      <p className="text-xs text-gray-500">Barcode: {selectedTemplate.barcode}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null);
                    resetForm();
                  }}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTemplatePicker(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 transition-colors text-center"
              >
                <span className="text-blue-600 font-medium">📋 Browse Templates</span>
                <span className="text-gray-500 text-sm ml-2">Search from shared catalog</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Fresh Milk 1L"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Item description (optional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                SKU
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="SKU code (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Barcode <span className="text-gray-500 font-normal text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter barcode number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Price (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Item Image
            </label>
            
            {/* File Upload */}
            <div className="mb-3">
              <label className="block w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 cursor-pointer transition-colors text-center">
                  <span className="text-blue-600 font-medium">
                    {imageFile ? 'Change Image' : 'Upload Image'}
                  </span>
                  <span className="text-gray-500 text-sm ml-2">(or paste URL below)</span>
                </div>
              </label>
              {uploadingImage && (
                <p className="text-sm text-blue-600 mt-2">Uploading image...</p>
              )}
            </div>

            {/* Image Preview */}
            {(imagePreview || imageUrl) && (
              <div className="mt-2">
                <img 
                  src={imagePreview || imageUrl} 
                  alt="Preview" 
                  className="w-32 h-32 object-cover rounded-xl border border-gray-200" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }} 
                />
                {imageFile && (
                  <p className="text-xs text-gray-500 mt-1">{imageFile.name}</p>
                )}
              </div>
            )}

            {/* URL Input (Alternative) */}
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">Or enter image URL:</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="https://example.com/image.jpg"
                disabled={!!imageFile}
              />
            </div>
          </div>

          {categories.length > 0 ? (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Categories <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedCategories.includes(category.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              {selectedCategories.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Please select at least one category</p>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-yellow-800 text-sm font-medium">
                ⚠️ No categories available. Please create a category first before adding items.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-900">
              Item is active (visible to customers)
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Choose from Template</h3>
                <p className="text-xs text-gray-500 mt-1">Search the shared catalog to quickly add items</p>
              </div>
              <button
                onClick={() => {
                  setShowTemplatePicker(false);
                  setTemplateSearch('');
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="px-6 pt-4 pb-2">
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search by name or barcode..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {templatesLoading ? (
                <div className="py-8 text-center text-gray-500">Loading templates...</div>
              ) : templates && templates.length > 0 ? (
                <div className="space-y-3 py-4">
                  {templates.map((template) => {
                    const alreadyAdded = template.id ? existingTemplateIds.has(template.id) : false;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          if (alreadyAdded) {
                            alert('This template is already in your inventory.');
                            return;
                          }
                          handleTemplateSelect(template);
                        }}
                        disabled={alreadyAdded}
                        className={`w-full p-4 border rounded-xl text-left transition-all ${
                          alreadyAdded
                            ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                            : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {template.imageUrl ? (
                              <img 
                                src={getImageUrl(template.imageUrl) || ''} 
                                alt={template.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="text-gray-400 font-semibold text-lg">
                                {template.name?.slice(0, 1).toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{template.name}</p>
                            {template.barcode && (
                              <p className="text-xs text-gray-500 mt-1">Barcode: {template.barcode}</p>
                            )}
                            {template.description && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{template.description}</p>
                            )}
                          </div>
                          {alreadyAdded && (
                            <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-semibold rounded-lg flex-shrink-0">
                              Already Added
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-gray-500">No templates found. Try adjusting your search.</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowTemplatePicker(false);
                  setTemplateSearch('');
                }}
                className="w-full px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

