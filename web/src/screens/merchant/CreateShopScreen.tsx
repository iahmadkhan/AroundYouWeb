import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../src/context/AuthContext';
import { createShop, uploadShopImage, type ShopType, type CreateShopData } from '../../../../src/services/merchant/shopService';
import ShopAddressMapModal from '../../components/merchant/ShopAddressMapModal';
import { useGeoapifyAutocomplete, type SearchResult } from '../../../../src/hooks/useLocationQueries';

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

interface CreateShopScreenProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function CreateShopScreen({ onClose, onSuccess }: CreateShopScreenProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Check if we're being used as a route (no onClose prop means it's a route)
  const isRoute = !onClose;
  
  // If accessed as route, redirect to dashboard and show as modal, or render dashboard behind
  useEffect(() => {
    if (isRoute && location.pathname === '/createshop') {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isRoute, location.pathname]);

  const initialAddress = (location.state as any)?.address || '';
  const initialLatitude = (location.state as any)?.latitude;
  const initialLongitude = (location.state as any)?.longitude;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shopType, setShopType] = useState<ShopType | null>(null);
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState<number | null>(initialLatitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude || null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState(address || '');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(
    latitude && longitude ? { latitude, longitude } : null
  );
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const isSavingLocationRef = useRef(false);
  
  const PAKISTAN_CENTER = {
    latitude: 31.451483,
    longitude: 74.435203,
  };

  const [mapRegion] = useState({
    latitude: PAKISTAN_CENTER.latitude,
    longitude: PAKISTAN_CENTER.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const { data: searchResults = [], isLoading: isSearchingQuery } = useGeoapifyAutocomplete(
    locationSearchQuery,
    locationSearchQuery.trim().length >= 2 && showSearchResults,
    mapRegion
  );

  useEffect(() => {
    // Check if we're returning from address selection (legacy support)
    const addressData = (location.state as any)?.address;
    if (addressData) {
      setAddress(addressData.formatted || addressData.address || '');
      setLatitude(addressData.latitude);
      setLongitude(addressData.longitude);
      setLocationSearchQuery(addressData.formatted || addressData.address || '');
      setMapCoords({ latitude: addressData.latitude, longitude: addressData.longitude });
    } else if (initialAddress) {
      setAddress(initialAddress);
      setLocationSearchQuery(initialAddress);
      if (initialLatitude !== undefined) setLatitude(initialLatitude);
      if (initialLongitude !== undefined) {
        setLongitude(initialLongitude);
        setMapCoords({ latitude: initialLatitude, longitude: initialLongitude });
      }
    }
  }, [location.state, initialAddress, initialLatitude, initialLongitude]);

  const handleLocationSearch = (query: string) => {
    setLocationSearchQuery(query);
    setShowSearchResults(query.trim().length >= 2);
  };

  const handleSelectResult = (result: SearchResult) => {
    setShowSearchResults(false);
    setLocationSearchQuery(result.address);
    setIsFocused(false);
    setMapCoords(result.coords);
    setShowLocationSearch(false);
    setShowMapModal(true);
  };

  const handleLocateMe = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
          const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&apiKey=${geoapifyKey}`;
          const res = await fetch(url);
          const json = await res.json();
          
          if (json?.results?.length > 0) {
            const result = json.results[0];
            const street = result?.street || '';
            const houseNumber = result?.housenumber || '';
            const district = result?.district || result?.suburb || '';
            const city = result?.city || '';
            const state = result?.state || '';
            const streetLine = [houseNumber, street].filter(Boolean).join(' ') || district || city || 'Street address';
            const full = result?.formatted || [streetLine, city, state].filter(Boolean).join(', ');

            // Update the search query with current location address
            setLocationSearchQuery(full);
            // Update map coordinates to point to current location
            setMapCoords({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setIsSearching(false);
            // Keep the search modal open so user can click forward to see it on map
          } else {
            setIsSearching(false);
            alert('Failed to get address. Please try again.');
          }
        } catch (error) {
          console.error('Reverse geocode error:', error);
          setIsSearching(false);
          alert('Failed to get address. Please try again.');
        }
      },
      (error) => {
        setIsSearching(false);
        alert('Location access denied. Please enter your address manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleForwardButton = async () => {
    if (!locationSearchQuery.trim()) {
      return;
    }

    // If we already have map coordinates (e.g., from Locate Me), use them directly
    if (mapCoords) {
      setShowLocationSearch(false);
      setShowMapModal(true);
      return;
    }

    // Otherwise, try to geocode the search query to get coordinates
    try {
      const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(locationSearchQuery)}&format=json&apiKey=${geoapifyKey}`;
      const res = await fetch(url);
      const json = await res.json();
      
      if (json?.results?.length > 0) {
        const result = json.results[0];
        setMapCoords({
          latitude: result.lat,
          longitude: result.lon,
        });
        setShowLocationSearch(false);
        setShowMapModal(true);
      } else {
        alert('Location not found. Please select from suggestions.');
      }
    } catch (error) {
      console.error('Geocode error:', error);
      alert('Failed to find location. Please try again.');
    }
  };

  const handleMapConfirm = (addressData: {
    formatted: string;
    address: string;
    streetLine?: string;
    city?: string;
    region?: string;
    latitude: number;
    longitude: number;
  }) => {
    // Mark that we're saving the location
    isSavingLocationRef.current = true;
    
    setAddress(addressData.formatted || addressData.address || '');
    setLatitude(addressData.latitude);
    setLongitude(addressData.longitude);
    setLocationSearchQuery(addressData.formatted || addressData.address || '');
    setShowMapModal(false);
    setShowLocationSearch(false); // Ensure location search modal is also closed
    setShowSearchResults(false); // Close search results dropdown
    
    // Reset the flag after a brief delay
    setTimeout(() => {
      isSavingLocationRef.current = false;
    }, 200);
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

  const [error, setError] = useState<string | null>(null);

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

  const handleCreateShop = async () => {
    if (!validateForm() || !user) return;

    try {
      setIsCreating(true);
      setError(null);

      // Create shop first (non-blocking), then upload image in background
      const shopData: CreateShopData = {
        name: name.trim(),
        description: description.trim(),
        shop_type: shopType!,
        address: address.trim(),
        latitude: latitude!,
        longitude: longitude!,
        image_url: undefined, // Will be updated after upload
        tags: tags.length > 0 ? tags : undefined,
      };

      // Create shop immediately (don't wait for image upload)
      const { shop, error } = await createShop(user.id, shopData);

      if (error) {
        setError(error.message);
        setIsCreating(false);
        return;
      }

      // Upload image in background and update shop if successful
      if (imageFile && shop) {
        // Don't block on image upload - do it in background
        (async () => {
          try {
            const reader = new FileReader();
            const dataUri = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(imageFile);
            });
            
            const { url, error: uploadError } = await uploadShopImage(user.id, dataUri);
            if (!uploadError && url && shop) {
              // Update shop with image URL (non-blocking)
              const { updateShop } = await import('../../../../src/services/merchant/shopService');
              await updateShop(shop.id, user.id, { image_url: url });
            }
          } catch (uploadErr) {
            console.warn('Background image upload failed:', uploadErr);
            // Don't show error to user - shop is already created
          }
        })();
      }

      // Close modal and refresh shops list immediately
      if (onSuccess) {
        onSuccess();
      }
      if (onClose) {
        onClose();
      } else {
        navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } });
      }
      setIsCreating(false);
    } catch (error: any) {
      setError(error.message || 'Failed to create shop');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create New Shop</h2>
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

        <form onSubmit={(e) => { e.preventDefault(); handleCreateShop(); }} className="p-6 space-y-4">
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
                onClick={() => {
                  setShowLocationSearch(true);
                  setLocationSearchQuery(address || '');
                }}
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
              disabled={isCreating}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>

      {/* Location Search Dropdown - Similar to navbar - Rendered via Portal */}
      {showLocationSearch && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4 pb-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 80px)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-5 py-4 flex items-center gap-3">
              <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-white font-medium text-sm flex-1 truncate">
                {locationSearchQuery || 'Enter shop address'}
              </span>
              <button
                onClick={() => setShowLocationSearch(false)}
                className="text-white/90 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Address Input Section */}
            <div className="p-5 border-b border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Enter shop address
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    className="w-full px-4 py-3 pr-20 text-base text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter shop location..."
                    value={locationSearchQuery}
                    onChange={(e) => handleLocationSearch(e.target.value)}
                    onFocus={() => {
                      setIsFocused(true);
                      if (locationSearchQuery.trim().length >= 2) {
                        setShowSearchResults(true);
                      }
                    }}
                    onBlur={(e) => {
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (!searchResultsRef.current?.contains(relatedTarget)) {
                        setTimeout(() => {
                          setShowSearchResults(false);
                          setIsFocused(false);
                        }, 200);
                      }
                    }}
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {locationSearchQuery.length > 0 && (
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setLocationSearchQuery('');
                          setShowSearchResults(false);
                        }}
                        className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        title="Clear"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {isFocused && (
                      <>
                        <div className="h-5 w-px bg-gray-300"></div>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleLocateMe();
                          }}
                          disabled={isSearching}
                          className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                          title="Locate Me"
                        >
                          {isSearching ? (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="hidden sm:inline text-xs">Locate</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleForwardButton();
                  }}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center min-w-[60px] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!locationSearchQuery.trim()}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Search Results */}
            {showSearchResults && locationSearchQuery.trim().length >= 2 && (
              <div ref={searchResultsRef} className="flex-1 overflow-y-auto border-b border-gray-200" style={{ maxHeight: '400px' }}>
                {isSearchingQuery && (
                  <div className="px-5 py-8 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-gray-500 text-sm">Searching...</p>
                  </div>
                )}
                
                {!isSearchingQuery && searchResults.length > 0 && (
                  <>
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-700">Did you mean:</p>
                    </div>
                    <div>
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="flex items-start py-4 px-5 border-b border-gray-100 w-full text-left hover:bg-blue-50 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectResult(item);
                          }}
                        >
                          <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-semibold text-gray-900 truncate">{item.name}</div>
                            <div className="text-sm text-gray-600 mt-1 line-clamp-2">{item.address}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {!isSearchingQuery && searchResults.length === 0 && (
                  <div className="px-5 py-8 text-center">
                    <p className="text-gray-500 text-sm">No locations found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Overlay to close location search - Rendered via Portal */}
      {showLocationSearch && createPortal(
        <div 
          className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm" 
          onClick={() => setShowLocationSearch(false)}
        />,
        document.body
      )}

      {/* Map Modal - Already uses Portal internally via ShopAddressMapModal */}
      {showMapModal && mapCoords && (
        <ShopAddressMapModal
          visible={showMapModal}
          onClose={() => {
            setShowMapModal(false);
            // Only reopen search if user cancelled without saving (not saving location)
            // Don't reopen if we're saving the location or if address is already set
            if (!isSavingLocationRef.current && !address && !latitude && !longitude) {
              setShowLocationSearch(true);
            }
          }}
          onConfirm={handleMapConfirm}
          initialAddress={locationSearchQuery || address || undefined}
          initialLatitude={mapCoords.latitude}
          initialLongitude={mapCoords.longitude}
        />
      )}
    </div>
  );
}

