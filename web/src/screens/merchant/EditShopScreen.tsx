import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../src/context/AuthContext';
import { updateShop, uploadShopImage, getMerchantShops, type ShopType, type CreateShopData, type MerchantShop } from '../../../../src/services/merchant/shopService';
import { getImageUrl } from '../../utils/imageUtils';
import ShopAddressMapModal from '../../components/merchant/ShopAddressMapModal';

const SHOP_TYPES: { label: string; value: ShopType; emoji: string }[] = [
  { label: 'Grocery', value: 'Grocery', emoji: '🛒' },
  { label: 'Meat', value: 'Meat', emoji: '🥩' },
  { label: 'Vegetable', value: 'Vegetable', emoji: '🥬' },
  { label: 'Stationery', value: 'Stationery', emoji: '📚' },
  { label: 'Dairy', value: 'Dairy', emoji: '🥛' },
];

const EXAMPLE_TAGS = [
  'Fresh Produce', 'Organic', 'Halal', 'Local', 'Fast Delivery',
  'Best Prices', '24/7', 'Bulk Orders', 'Home Delivery', 'Quality Assured',
];

interface EditShopScreenProps {
  shop?: MerchantShop;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function EditShopScreen({ shop: propShop, onClose, onSuccess }: EditShopScreenProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const shop: MerchantShop | null = propShop || (location.state as any)?.shop || null;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shopType, setShopType] = useState<ShopType | null>(null);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  useEffect(() => {
    if (!shop) {
      navigate(-1);
      return;
    }

    // Pre-fill form with shop data
    setName(shop.name || '');
    setDescription(shop.description || '');
    setShopType(shop.shop_type || null);
    setAddress(shop.address || '');
    setLatitude(shop.latitude || null);
    setLongitude(shop.longitude || null);
    setTags(shop.tags || []);
    
    // Set image preview if shop has an image
    if (shop.image_url) {
      setImagePreview(getImageUrl(shop.image_url));
    }
    
    // Reset image removal flag when shop data loads
    setImageRemoved(false);

    setLoading(false);
  }, [shop, navigate]);

  useEffect(() => {
    // Check if we're returning from address selection (legacy support)
    const addressData = (location.state as any)?.address;
    if (addressData) {
      setAddress(addressData.formatted || addressData.address || '');
      setLatitude(addressData.latitude);
      setLongitude(addressData.longitude);
    }
  }, [location.state]);

  const handleMapConfirm = (addressData: {
    formatted: string;
    address: string;
    streetLine?: string;
    city?: string;
    region?: string;
    latitude: number;
    longitude: number;
  }) => {
    setAddress(addressData.formatted || addressData.address || '');
    setLatitude(addressData.latitude);
    setLongitude(addressData.longitude);
    setShowMapModal(false);
    // Ensure modal is properly closed and user can continue editing
  };

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true); // Mark that image was explicitly removed
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddExampleTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
    }
  };

  const validateForm = (): boolean => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a shop name');
      return false;
    }
    if (!description.trim()) {
      setError('Please enter a shop description');
      return false;
    }
    if (!shopType) {
      setError('Please select a shop type');
      return false;
    }
    if (!address.trim()) {
      setError('Please select an address');
      return false;
    }
    if (latitude === null || longitude === null) {
      setError('Please select a valid address location');
      return false;
    }
    return true;
  };

  const handleUpdateShop = async () => {
    if (!validateForm() || !user || !shop) return;

    try {
      setIsUpdating(true);

      let imageUrl: string | null | undefined;

      if (imageFile) {
        // User uploaded a new image
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
        const { url, error: uploadError } = await uploadShopImage(user.id, dataUri);
        if (uploadError) {
          setError(uploadError.message);
          setIsUpdating(false);
          return;
        }
        imageUrl = url || undefined;
      } else if (imageRemoved) {
        // User explicitly removed the image - set to null to remove it
        imageUrl = null;
      } else {
        // No change to image - keep existing (undefined means don't update)
        imageUrl = undefined;
      }

      const shopData: Partial<CreateShopData> & { image_url?: string | null } = {
        name: name.trim(),
        description: description.trim(),
        shop_type: shopType!,
        address: address.trim(),
        latitude: latitude!,
        longitude: longitude!,
        tags: tags.length > 0 ? tags : undefined,
      };
      
      // Handle image_url separately to allow null for deletion
      if (imageUrl !== undefined) {
        (shopData as any).image_url = imageUrl;
      }

      const { error } = await updateShop(shop.id, user.id, shopData);

      if (error) {
        setError(error.message);
        setIsUpdating(false);
        return;
      }

      // Close modal and refresh shops list
      if (onSuccess) {
        onSuccess();
      }
      if (onClose) {
        onClose();
      } else {
        navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } });
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update shop');
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading shop data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Shop</h2>
          <button
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } });
              }
            }}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleUpdateShop(); }} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          {/* Shop Picture */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Shop Picture (Optional)
            </label>
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Shop preview"
                  className="w-full h-48 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-3 right-3 bg-red-500 rounded-full w-8 h-8 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="block w-full h-48 bg-gray-50 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100 hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickImage}
                  className="hidden"
                />
                <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-600 text-sm font-medium">Click to upload image</span>
              </label>
            )}
          </div>

          {/* Shop Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Shop Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Fresh Grocery Store"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe your shop..."
              rows={3}
              required
            />
          </div>

          {/* Shop Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Shop Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {SHOP_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setShopType(type.value)}
                  className={`px-4 py-3 rounded-xl border-2 transition-all ${
                    shopType === type.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.emoji}</div>
                  <div className={`text-xs font-semibold ${shopType === type.value ? 'text-blue-600' : 'text-gray-700'}`}>
                    {type.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                placeholder="Select address on map"
                value={address}
                readOnly
              />
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className="px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all whitespace-nowrap"
              >
                Select Location
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Tags (Optional)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2 font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-blue-700 hover:text-blue-900"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddExampleTag(tag)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors font-medium"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } })}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Updating...' : 'Update Shop'}
            </button>
          </div>
        </form>
      </div>

      {/* Map Modal */}
      <ShopAddressMapModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onConfirm={handleMapConfirm}
        initialAddress={address || undefined}
        initialLatitude={latitude || undefined}
        initialLongitude={longitude || undefined}
      />
    </div>
  );
}

