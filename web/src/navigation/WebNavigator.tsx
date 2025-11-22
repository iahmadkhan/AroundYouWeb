import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from '../../../src/context/AuthContext';
import { LocationProvider } from '../../../src/context/LocationContext';
import { CartProvider } from '../../../src/context/CartContext';
import { OrderApprovalProvider } from '../context/OrderApprovalContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useUserLocation } from '../../../src/hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../../src/context/LocationContext';
import { useLocationStore } from '../../../src/stores/locationStore';
import { useCart } from '../../../src/context/CartContext';
import { useCartStore } from '../../../src/stores/cartStore';
import { fetchDeliveryLogic } from '../../../src/services/merchant/deliveryLogicService';
import { calculateOrderSurcharge } from '../../../src/services/merchant/deliveryLogicService';
import { useGeoapifyAutocomplete, SearchResult } from '../../../src/hooks/useLocationQueries';
import { supabase } from '../../../src/services/supabase';
import { getImageUrl } from '../utils/imageUtils';
import WebMap from '../components/WebMap';
import FavoriteIcon from '../../../src/icons/FavoriteIcon';
import CartIcon from '../../../src/icons/CartIcon';
import SideCart from '../components/SideCart';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { useOrderApproval } from '../context/OrderApprovalContext';
import OrderApprovalModal from '../components/OrderApprovalModal';
import { subscribeToOrder, getOrderById } from '../../../src/services/consumer/orderService';
import ThankYouOrderModal from '../components/ThankYouOrderModal';
import ReviewRatingModal from '../components/ReviewRatingModal';
import OrderStatusScreen from '../screens/OrderStatusScreen';
import MobileDrawer from '../components/MobileDrawer';

// Import web screens (React.js versions)
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';

// Import web screens (React.js versions)
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import SignUpScreen from '../screens/SignUpScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrdersScreen from '../screens/OrdersScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import HelpCenterScreen from '../screens/HelpCenterScreen';
import TermsScreen from '../screens/TermsScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
// Import remaining screens (some still need conversion)
import PlaceholderScreen from '../screens/PlaceholderScreen';
import MerchantDashboard from '../screens/merchant/MerchantDashboard';
import MerchantRegistrationSurveyScreen from '../screens/merchant/MerchantRegistrationSurveyScreen';
import AuthCallbackScreen from '../screens/AuthCallbackScreen';
import AddressSearchScreen from '../screens/consumer/AddressSearchScreen';
import ConsumerAddressManagementScreen from '../screens/consumer/ConsumerAddressManagementScreen';
import ShopDetailScreen from '../screens/consumer/ShopDetailScreen';
import CreateShopScreen from '../screens/merchant/CreateShopScreen';
import EditShopScreen from '../screens/merchant/EditShopScreen';
import ViewShopScreen from '../screens/merchant/ViewShopScreen';
import ShopAddressMapScreen from '../screens/merchant/ShopAddressMapScreen';
import MerchantShopPortalScreen from '../screens/merchant/shop/MerchantShopPortalScreen';
import ManageDeliveryAreasScreen from '../screens/merchant/shop/ManageDeliveryAreasScreen';
import MerchantProfileScreen from '../screens/merchant/MerchantProfileScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

function LocationPinIcon({
  className = '',
  strokeWidth = 2,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={strokeWidth}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 10c0 5-7 11-7 11s-7-6-7-11a7 7 0 1114 0z"
      />
    </svg>
  );
}

// Navigation wrapper component to provide navigation context
function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Wrapper components that inject navigation props
function withNavigation(Component: any) {
  return (props: any) => {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();

    // Create navigation object compatible with React Navigation
    const navigation = {
      navigate: (name: string, params?: any) => {
        navigate(`/${name.toLowerCase()}`, { state: params });
      },
      goBack: () => {
        navigate(-1);
      },
      replace: (name: string, params?: any) => {
        navigate(`/${name.toLowerCase()}`, { replace: true, state: params });
      },
      setParams: (params: any) => {
        // Not needed for web
      },
    };

    // Create route object
    const route = {
      params: params || location.state || {},
    };

    return <Component {...props} navigation={navigation} route={route} />;
  };
}

// Location Search Bar Component (integrated in TopNavBar)
function LocationSearchInNav() {
  const navigate = useNavigate();
  const selectedAddress = useLocationStore((state) => state.confirmedLocation);
  const { setSelectedAddress } = useLocationSelection();
  const { user } = useAuth();
  
  const DEFAULT_ADDRESS = 'New address Service Road W Islamabad';
  const PAKISTAN_CENTER = {
    latitude: 31.451483,
    longitude: 74.435203,
  };

  const [searchQuery, setSearchQuery] = useState(
    selectedAddress?.address || selectedAddress?.streetLine || DEFAULT_ADDRESS
  );
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  // When true, the address selector is opened in "select only" mode (no editing/adding),
  // used when coming from the order progress "Change address" button.
  const [selectOnlyMode, setSelectOnlyMode] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isLocatingInModal, setIsLocatingInModal] = useState(false);
  const [reverseGeocodeResult, setReverseGeocodeResult] = useState<{
    formatted: string;
    city?: string;
    region?: string;
    streetLine?: string;
  } | null>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const isUserTypingRef = useRef(false);
  const hasClearedDefaultRef = useRef(false);
  const mapRef = useRef<any>(null);

  const [mapRegion] = useState({
    latitude: PAKISTAN_CENTER.latitude,
    longitude: PAKISTAN_CENTER.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const { data: searchResults = [], isLoading: isSearchingQuery } = useGeoapifyAutocomplete(
    searchQuery,
    searchQuery.trim().length >= 2 && showSearchResults,
    mapRegion
  );

  // Initialize search query from persisted location on mount and when store updates
  useEffect(() => {
    // Only update if user hasn't manually cleared or typed
    if (!isUserTypingRef.current && !hasClearedDefaultRef.current) {
      const addressText = selectedAddress?.address || selectedAddress?.streetLine;
      if (addressText && addressText !== DEFAULT_ADDRESS) {
        setSearchQuery(addressText);
      }
    }
  }, [selectedAddress?.address, selectedAddress?.streetLine]);

  // Fetch saved addresses when dropdown opens
  useEffect(() => {
    if (showSearchDropdown && user) {
      fetchSavedAddresses();
    }
  }, [showSearchDropdown, user]);

  const fetchSavedAddresses = async () => {
    if (!user) return;
    setLoadingAddresses(true);
    try {
      const { getUserAddresses } = await import('../../../src/services/consumer/addressService');
      const { data, error } = await getUserAddresses();
      if (!error && data) {
        setSavedAddresses(data);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSelectSavedAddress = async (address: any) => {
    const coords = {
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };
    const addressText = address.formatted_address || address.street_address;
    setSearchQuery(addressText);
    hasClearedDefaultRef.current = false; // Reset when user selects a saved address
    setMapCoords(coords);
    setShowSearchDropdown(false);
    setShowMapModal(true);
    
    // Reverse geocode to get full address details
    try {
      const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&apiKey=${geoapifyKey}`;
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
        setSearchQuery(full);
        setReverseGeocodeResult({
          formatted: full,
          city: city,
          region: state,
          streetLine: streetLine,
        });
        isUserTypingRef.current = false;
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      // Keep the original address text if reverse geocoding fails
      setReverseGeocodeResult(null);
    }
    
    // Animate map to the saved address location
    if (mapRef.current?.animateCamera) {
      setTimeout(() => {
        mapRef.current.animateCamera({
          center: coords,
          zoom: 16,
        }, { duration: 1000 });
      }, 100);
    }
  };

  // Allow other screens (e.g. order status) to open the address selector in select-only mode
  useEffect(() => {
    const win: any = (globalThis as any)?.window;
    if (!win) return;

    const handler = () => {
      // Open dropdown focused on saved addresses only
      setSelectOnlyMode(true);
      setShowSearchDropdown(true);
      setIsFocused(false);
      setShowSearchResults(false);
    };

    win.addEventListener('aroundyou:openAddressMapModal', handler as EventListener);
    return () => {
      win.removeEventListener('aroundyou:openAddressMapModal', handler as EventListener);
    };
  }, []);

  const handleSearch = (query: string) => {
    isUserTypingRef.current = query.length > 0;
    setSearchQuery(query);
    setShowSearchResults(query.trim().length >= 2);
    // Reset the cleared default flag when user types
    if (query.trim().length > 0) {
      hasClearedDefaultRef.current = false;
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    setShowSearchResults(false);
    isUserTypingRef.current = false;
    setSearchQuery(result.address);
    setIsFocused(false);
    setShowSearchDropdown(false);
    hasClearedDefaultRef.current = false; // Reset when user selects a location
    // Just update the search query, don't navigate to a new screen
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

            // Just update the search query, don't navigate
            setSearchQuery(full);
            isUserTypingRef.current = false;
            setIsSearching(false);
            hasClearedDefaultRef.current = false; // Reset when user locates themselves
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

  const handleLocateMeInModal = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocatingInModal(true);
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

            // Update search query
            setSearchQuery(full);
            isUserTypingRef.current = false;
            hasClearedDefaultRef.current = false;

            // Update map coordinates
            const newCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setMapCoords(newCoords);

            // Animate map to current location
            if (mapRef.current?.animateCamera) {
              mapRef.current.animateCamera({
                center: newCoords,
                zoom: 16,
              }, { duration: 1000 });
            }

            setIsLocatingInModal(false);
          } else {
            setIsLocatingInModal(false);
            alert('Failed to get address. Please try again.');
          }
        } catch (error) {
          console.error('Reverse geocode error:', error);
          setIsLocatingInModal(false);
          alert('Failed to get address. Please try again.');
        }
      },
      (error) => {
        setIsLocatingInModal(false);
        alert('Location access denied. Please enter your address manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleForwardButton = async () => {
    if (!searchQuery.trim() || searchQuery.trim() === DEFAULT_ADDRESS) {
      return;
    }

    // Try to geocode the search query to get coordinates
    try {
      const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(searchQuery)}&format=json&apiKey=${geoapifyKey}`;
      const res = await fetch(url);
      const json = await res.json();
      
      if (json?.results?.length > 0) {
        const result = json.results[0];
        setMapCoords({
          latitude: result.lat,
          longitude: result.lon,
        });
        setShowSearchDropdown(false);
        setShowMapModal(true);
      } else {
        alert('Location not found. Please select from suggestions.');
      }
    } catch (error) {
      console.error('Geocode error:', error);
      alert('Failed to find location. Please try again.');
    }
  };

  return (
    <div className="relative flex-1 max-w-md mx-2 sm:mx-4">
      <button
        onClick={() => {
          setShowSearchDropdown(true);
          setIsFocused(true);
        }}
        className="flex items-center text-white/90 hover:text-white transition-all duration-200 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 rounded-lg hover:bg-white/20"
      >
        <LocationPinIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 flex-shrink-0 text-white/90" />
        <span className="max-w-[120px] sm:max-w-xs truncate text-left">
          {searchQuery}
        </span>
      </button>

      {/* Search Dropdown */}
      {showSearchDropdown && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 80px)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-5 py-4 flex items-center gap-3">
              <LocationPinIcon className="w-6 h-6 text-white flex-shrink-0" />
              <span className="text-white font-medium text-sm flex-1 truncate">
                {searchQuery}
              </span>
              <button
                onClick={() => {
                  setShowSearchDropdown(false);
                  setSelectOnlyMode(false);
                }}
                className="text-white/90 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Address Input Section */}
            {!selectOnlyMode && (
              <div className="p-5 border-b border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Enter your address
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      className="w-full px-4 py-3 pr-20 text-base text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your delivery location..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() => {
                        setIsFocused(true);
                        if (searchQuery.trim().length >= 2) {
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
                      {searchQuery.length > 0 && (
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (searchQuery === DEFAULT_ADDRESS) {
                              // Remove default address and prevent it from coming back
                              setSearchQuery('');
                              hasClearedDefaultRef.current = true;
                            } else {
                              // Clear any other address
                              setSearchQuery('');
                            }
                            setShowSearchResults(false);
                            isUserTypingRef.current = false;
                          }}
                          className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                          title={searchQuery === DEFAULT_ADDRESS ? "Remove" : "Clear"}
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
                                <LocationPinIcon className="w-4 h-4" />
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
                    disabled={!searchQuery.trim() || searchQuery.trim() === DEFAULT_ADDRESS}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Search Results */}
            {!selectOnlyMode && showSearchResults && searchQuery.trim().length >= 2 && (
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
                          <LocationPinIcon className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
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

            {/* Saved Addresses Section */}
            {!showSearchResults && (
              <div className="flex-1 overflow-y-auto p-5" style={{ maxHeight: '400px' }}>
                <h3 className="text-base font-bold text-gray-900 mb-4">Saved Addresses</h3>
                {loadingAddresses ? (
                  <div className="py-4 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : savedAddresses.length > 0 ? (
                  <div className="space-y-2">
                    {savedAddresses.map((address) => (
                      <button
                        key={address.id}
                        onClick={() => handleSelectSavedAddress(address)}
                        className="flex items-center gap-3 py-3 px-4 w-full text-left hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <LocationPinIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {address.title && (
                            <div className="text-xs font-semibold text-blue-600 uppercase mb-1">
                              {address.title}
                            </div>
                          )}
                          <span className="text-gray-900 font-medium text-sm block truncate">
                            {address.formatted_address || address.street_address}
                          </span>
                          {address.city && (
                            <span className="text-gray-500 text-xs">{address.city}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No saved addresses yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {showSearchDropdown && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" 
          onClick={() => {
            setShowSearchDropdown(false);
            setSelectOnlyMode(false);
          }}
        />
      )}

      {/* Map Modal */}
      {showMapModal && mapCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LocationPinIcon className="w-6 h-6 text-white flex-shrink-0" />
                <span className="text-white font-medium text-sm flex-1 truncate">
                  {searchQuery}
                </span>
              </div>
              <button
                onClick={() => setShowMapModal(false)}
                className="text-white/90 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Address Input */}
              <div className="px-6 pt-4 pb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enter your address
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      className="w-full px-4 py-3 pr-24 text-base text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your delivery location..."
                      value={searchQuery}
                      onChange={async (e) => {
                        handleSearch(e.target.value);
                        // If user types a new address, try to geocode it
                        if (e.target.value.trim().length > 5 && e.target.value !== DEFAULT_ADDRESS) {
                          try {
                            const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
                            const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(e.target.value)}&format=json&apiKey=${geoapifyKey}`;
                            const res = await fetch(url);
                            const json = await res.json();
                            if (json?.results?.length > 0) {
                              const result = json.results[0];
                              setMapCoords({
                                latitude: result.lat,
                                longitude: result.lon,
                              });
                            }
                          } catch (error) {
                            console.error('Geocode error:', error);
                          }
                        }
                      }}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {searchQuery.length > 0 && (
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (searchQuery === DEFAULT_ADDRESS) {
                              // Remove default address and prevent it from coming back
                              setSearchQuery('');
                              hasClearedDefaultRef.current = true;
                            } else {
                              // Clear any other address
                              setSearchQuery('');
                            }
                            isUserTypingRef.current = false;
                          }}
                          className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                          title={searchQuery === DEFAULT_ADDRESS ? "Remove" : "Clear"}
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <div className="h-5 w-px bg-gray-300"></div>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleLocateMeInModal();
                        }}
                        disabled={isLocatingInModal}
                        className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                        title="Locate Me"
                      >
                        {isLocatingInModal ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <LocationPinIcon className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs">Locate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div className="px-6 pb-4">
                <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: '450px' }}>
                  <WebMap
                    mapRef={mapRef}
                    initialRegion={{
                      latitude: mapCoords.latitude,
                      longitude: mapCoords.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    showsUserLocation={true}
                    onRegionChangeComplete={async (region) => {
                      setMapCoords({
                        latitude: region.latitude,
                        longitude: region.longitude,
                      });
                      // Reverse geocode to update address in search bar
                      try {
                        const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
                        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${region.latitude}&lon=${region.longitude}&format=json&apiKey=${geoapifyKey}`;
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
                          setSearchQuery(full);
                          setReverseGeocodeResult({
                            formatted: full,
                            city: city,
                            region: state,
                            streetLine: streetLine,
                          });
                          isUserTypingRef.current = false;
                        }
                      } catch (error) {
                        console.error('Reverse geocode error:', error);
                        setReverseGeocodeResult(null);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Confirm Button */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => {
                    if (!mapCoords) return;
                    // Use reverse geocode result if available, otherwise use search query
                    const addressLabel = reverseGeocodeResult?.formatted || reverseGeocodeResult?.streetLine || searchQuery || 'Selected location';
                    const city = reverseGeocodeResult?.city || '';
                    
                    setSelectedAddress({
                      label: addressLabel,
                      city: city,
                      coords: mapCoords,
                      isCurrent: false,
                      addressId: null,
                    });
                    setShowMapModal(false);
                    setReverseGeocodeResult(null); // Reset after use
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-6 rounded-xl font-semibold text-base transition-colors shadow-md hover:shadow-lg"
                >
                  Use This Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close map modal */}
      {showMapModal && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" 
          onClick={() => setShowMapModal(false)}
        />
      )}
    </div>
  );
}

// Order Notification Button Component
function OrderNotificationButton() {
  const { activeOrder, showModal, setShowModal, setActiveOrder } = useOrderApproval();

  // If there is no active order in context (or it's terminal), hide the bell
  if (!activeOrder || activeOrder.status === 'delivered' || activeOrder.status === 'cancelled') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-1.5 sm:p-2 md:p-2.5 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 flex items-center justify-center relative"
        title="Active Order"
      >
        <span className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] flex items-center justify-center overflow-hidden text-xl">
          🔔
        </span>
        {/* Notification badge */}
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold shadow-md animate-pulse">
          !
        </span>
      </button>
      {showModal && activeOrder && (
        <OrderApprovalModal
          order={activeOrder}
          onClose={() => {
            setShowModal(false);
            if (activeOrder.status === 'delivered' || activeOrder.status === 'cancelled') {
              setActiveOrder(null);
            }
          }}
        />
      )}
    </>
  );
}

// Modern Top Navigation Bar Component (Foodpanda-style)
function TopNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showCartDropdown, setShowCartDropdown] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [cartFeesTotal, setCartFeesTotal] = useState(0);
  const [loadingCartFees, setLoadingCartFees] = useState(false);
  const [showEmptyCartConfirm, setShowEmptyCartConfirm] = useState(false);
  const [showClearShopConfirm, setShowClearShopConfirm] = useState(false);
  const [clearShopId, setClearShopId] = useState<string | null>(null);
  const [clearShopName, setClearShopName] = useState<string>('');
  const [shopImages, setShopImages] = useState<Record<string, string | null>>({});
  const [showFreeDeliveryWarning, setShowFreeDeliveryWarning] = useState(false);
  
  // Get location and user data - hooks must be called unconditionally
  const { selectedAddress } = useLocationSelection();
  const { placeLabel, loading: locationLoading } = useUserLocation();
  const { user, signOut } = useAuth();
  const { getItemCount, getAllItems, getShopIds, getShopCart, removeItem, updateQuantity, getTotalPrice, clearCart } = useCart();
  const allCartItems = getAllItems();
  const [cartFeesDetails, setCartFeesDetails] = useState<Record<string, { smallOrderSurcharge: number; baseDeliveryFee: number; deliveryLogic: any }>>({});

  const locationLabel = selectedAddress?.label || 
    (locationLoading ? 'Fetching your location…' : (placeLabel || 'Select your address'));


  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/home');
      setShowProfileDropdown(false);
    } catch (error: any) {
      alert(`Logout Error: ${error?.message || 'Failed to logout. Please try again.'}`);
    }
  };

  // Fetch shop images when cart dropdown opens
  React.useEffect(() => {
    const fetchShopImages = async () => {
      if (!showCartDropdown) return;
      
      const shopIds = getShopIds();
      if (shopIds.length === 0) {
        setShopImages({});
        return;
      }

      const images: Record<string, string | null> = {};
      const promises = shopIds.map(async (shopId) => {
        const { data, error } = await supabase
          .from('shops')
          .select('image_url')
          .eq('id', shopId)
          .single();
        
        if (!error && data) {
          const shopData = data as { image_url: string | null } | null;
          images[shopId] = shopData?.image_url ? getImageUrl(shopData.image_url) || null : null;
        } else {
          images[shopId] = null;
        }
      });

      await Promise.all(promises);
      setShopImages(images);
    };

    fetchShopImages();
  }, [showCartDropdown, getShopIds]);

  // Calculate cart fees when cart dropdown opens or items change
  React.useEffect(() => {
    const calculateFees = async () => {
      if (!showCartDropdown) return;
      
      setLoadingCartFees(true);
      const shopIds = getShopIds();
      if (shopIds.length === 0) {
        setCartFeesTotal(0);
        setLoadingCartFees(false);
        return;
      }

      let totalFees = 0;
      const feesDetails: Record<string, { smallOrderSurcharge: number; baseDeliveryFee: number; deliveryLogic: any }> = {};

      const promises = shopIds.map(async (shopId) => {
        const shopCart = getShopCart(shopId);
        if (!shopCart) return;

        const { data: deliveryLogic } = await fetchDeliveryLogic(shopId);
        const subtotal = getTotalPrice(shopId);

        // Calculate small order surcharge
        const smallOrderSurcharge = deliveryLogic
          ? calculateOrderSurcharge(subtotal / 100, deliveryLogic) * 100
          : 0;

        // Use maxDeliveryFee as estimate for delivery fee
        const baseDeliveryFee = deliveryLogic ? deliveryLogic.maxDeliveryFee * 100 : 0;
        
        feesDetails[shopId] = {
          smallOrderSurcharge,
          baseDeliveryFee,
          deliveryLogic,
        };
        
        totalFees += baseDeliveryFee + smallOrderSurcharge;
      });

      await Promise.all(promises);
      setCartFeesDetails(feesDetails);
      setCartFeesTotal(totalFees);
      setLoadingCartFees(false);
    };

    calculateFees();
  }, [showCartDropdown, allCartItems.length, getShopIds, getShopCart, getTotalPrice]);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProfileDropdown && !target.closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
      if (showCartDropdown && !target.closest('.cart-dropdown')) {
        setShowCartDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown, showCartDropdown]);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 shadow-md h-14 sm:h-16 md:h-[56px]">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 h-full">
          <div className="flex items-center justify-between h-full py-1.5 sm:py-2 md:py-2.5 lg:py-3">
            {/* Left Section: Mobile Menu + Logo + Location */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 flex-1 min-w-0">
              {/* Mobile Menu Button */}
            <button
                onClick={() => setShowMobileDrawer(true)}
                className="lg:hidden p-2 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 flex-shrink-0"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Logo */}
              <motion.button
              onClick={() => navigate('/home')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              className="flex items-center hover:opacity-80 transition-all duration-200 group flex-shrink-0"
            >
              <img 
                src="/Applogo.svg" 
                alt="AroundYou Logo" 
                  className="h-8 sm:h-10 md:h-12 lg:h-14 xl:h-16 w-auto group-hover:opacity-90 transition-opacity brightness-0 invert"
                  loading="lazy"
              />
              </motion.button>

              {/* Location Selector - Hidden on mobile, shown on desktop */}
              <div className="hidden lg:block flex-1 min-w-0">
            <LocationSearchInNav />
              </div>
          </div>

          {/* Right Section: Profile, Favorites, Notifications, Cart */}
          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 lg:gap-3 xl:gap-4 flex-shrink-0">
            {/* Favorites - Hidden on mobile (available in drawer) */}
            <motion.button
              onClick={() => navigate('/favorites')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="hidden lg:flex p-1.5 sm:p-2 md:p-2.5 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 items-center justify-center"
              title="Favorites"
            >
              <span className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] flex items-center justify-center overflow-hidden">
              <FavoriteIcon size={22} color="currentColor" />
              </span>
            </motion.button>

            {/* Order Notification - Hidden on mobile */}
            <div className="hidden lg:block">
            <OrderNotificationButton />
            </div>

            {/* Cart with Dropdown */}
            <div className="relative cart-dropdown">
              <motion.button
                onClick={() => {
                  setShowCartDropdown(!showCartDropdown);
                  setShowProfileDropdown(false);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1.5 sm:p-2 md:p-2.5 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 relative flex items-center justify-center"
              title="Cart"
            >
                <span className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] flex items-center justify-center overflow-hidden">
              <CartIcon size={22} color="currentColor" />
                </span>
                {/* Cart badge - shows item count */}
                {getItemCount() > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-white text-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold shadow-md"
                  >
                    {getItemCount() > 99 ? '99+' : getItemCount()}
                  </motion.span>
                )}
              </motion.button>

              {/* Cart Side Panel */}
              {showCartDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/50 z-[90] transition-opacity duration-300 ease-in-out cart-dropdown"
                    onClick={() => setShowCartDropdown(false)}
                  />
                  
                  {/* Side Panel - Slides in from right */}
                  <div className={`fixed right-0 top-0 h-full w-full sm:w-[380px] md:w-[420px] lg:w-[450px] bg-white shadow-2xl z-[100] cart-dropdown flex flex-col transform transition-transform duration-300 ease-in-out ${
                    showCartDropdown ? 'translate-x-0' : 'translate-x-full'
                  }`}>
                    {/* Blue Header with "Your carts" and address */}
                    <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white mb-1">Your carts</h3>
                        <p className="text-sm text-white/90 truncate" title={locationLabel}>
                          {locationLabel}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowCartDropdown(false)}
                        className="text-white/90 hover:text-white transition-colors p-1 flex-shrink-0 ml-3"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Cart Items - Grouped by Shop */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      {getAllItems().length === 0 ? (
                        <div className="py-16 text-center">
                          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                            <span className="text-5xl">🛒</span>
                          </div>
                          <p className="text-gray-700 font-semibold text-lg mb-1">Your cart is empty</p>
                          <p className="text-sm text-gray-500">Add items to get started</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {getShopIds().map((shopId) => {
                            const shopCart = getShopCart(shopId);
                            if (!shopCart || shopCart.items.length === 0) return null;
                            const shopImage = shopImages[shopId];
                            
                            return (
                              <div key={shopId} className="bg-white rounded-2xl shadow-md p-4 transition-all hover:shadow-lg">
                                {/* Shop Header with Image, Name, and Trash Icon */}
                                <div className="flex items-center gap-3 mb-3">
                                  {/* Shop Image */}
                                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 flex items-center justify-center">
                                    {shopImage ? (
                                      <img src={shopImage} alt={shopCart.shopName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xl">🏪</span>
                                    )}
                                  </div>
                                  
                                  {/* Shop Name - Truncated */}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-bold text-gray-900 truncate" title={shopCart.shopName}>
                                      {shopCart.shopName}
                                    </h4>
                                  </div>
                                  
                                  {/* Trash Icon */}
                                  <button
                                    onClick={() => {
                                      setClearShopId(shopId);
                                      setClearShopName(shopCart.shopName);
                                      setShowClearShopConfirm(true);
                                    }}
                                    className="text-gray-400 hover:text-red-600 transition-colors p-1.5 flex-shrink-0"
                                    title="Remove shop cart"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                                
                                {/* Product Thumbnails Row */}
                                <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 hide-scrollbar">
                                  {shopCart.items.map((item) => (
                                    <div key={item.id} className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 flex items-center justify-center">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-lg">📦</span>
                                      )}
                                    </div>
                                  ))}
                                  
                                  {/* + Circle Button to Add More Items */}
                                  <button
                                    onClick={() => {
                                      setShowCartDropdown(false);
                                      navigate(`/shop/${shopId}`);
                                    }}
                                    className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                                    title="Add more items from this shop"
                                  >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </button>
                                </div>
                                
                                {/* Go to Checkout Button */}
                                <button
                                  onClick={() => {
                                    setShowCartDropdown(false);
                                    navigate('/cart', {
                                      state: { checkoutShopId: shopId },
                                    });
                                  }}
                                  className="w-full border-2 border-blue-600 text-blue-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all duration-200"
                                >
                                  Go to checkout
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </>
              )}
            </div>

            {/* Profile with Dropdown */}
            <div className="relative profile-dropdown">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                <span className="text-lg sm:text-xl">👤</span>
                <span className="hidden lg:inline text-sm font-medium">
                  {user?.email?.split('@')[0] || 'Profile'}
                </span>
                <span className="text-xs hidden sm:inline">▾</span>
              </button>

              {/* Profile Dropdown */}
              <AnimatePresence>
              {showProfileDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-48 sm:w-56 md:w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[60] profile-dropdown backdrop-blur-sm max-h-[calc(100vh-80px)] overflow-y-auto"
                  >
                  {/* Subscribe to free delivery */}
                  <button
                    onClick={() => {
                      setShowFreeDeliveryWarning(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                  >
                    <span className="text-purple-600 text-lg">👑</span>
                    <span>Subscribe to free delivery</span>
                  </button>

                  {/* Orders & reordering */}
                  <button
                    onClick={() => {
                      navigate('/orders');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                  >
                    <span className="text-gray-600 text-lg">📄</span>
                    <span>Orders & reordering</span>
                  </button>

                  {/* Profile */}
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <span className="text-gray-600 text-lg">👤</span>
                    <span>Profile</span>
                  </button>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-1"></div>

                  {/* Help Center */}
                  <button
                    onClick={() => {
                      navigate('/help');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                  >
                    <span className="text-gray-600 text-lg">❓</span>
                    <span>Help Center</span>
                  </button>

                  {/* Logout */}
                  {user && (
                  <button
                      onClick={handleLogout}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <span className="text-gray-600 text-lg">🚪</span>
                    <span>Logout</span>
                  </button>
                  )}
                  </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      </nav>

      {/* Mobile Drawer */}
      <MobileDrawer isOpen={showMobileDrawer} onClose={() => setShowMobileDrawer(false)} />

      {/* Clear Shop Confirmation */}
      <ConfirmationDialog
        isOpen={showClearShopConfirm}
        title="Clear Shop Cart"
        message={`Are you sure you want to remove all items from ${clearShopName}? This action cannot be undone.`}
        confirmText="Clear Cart"
        cancelText="Cancel"
        variant="warning"
        onConfirm={() => {
          if (clearShopId) {
            clearCart(clearShopId);
          }
          setShowClearShopConfirm(false);
          setClearShopId(null);
          setClearShopName('');
        }}
        onCancel={() => {
          setShowClearShopConfirm(false);
          setClearShopId(null);
          setClearShopName('');
        }}
      />

      {/* Empty Cart Confirmation */}
      <ConfirmationDialog
        isOpen={showEmptyCartConfirm}
        title="Empty Entire Cart"
        message="Are you sure you want to remove all items from all shops? This action cannot be undone."
        confirmText="Empty Cart"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          clearCart();
          setShowCartDropdown(false);
          setShowEmptyCartConfirm(false);
        }}
        onCancel={() => setShowEmptyCartConfirm(false)}
      />

      {/* Free Delivery Subscription Warning */}
      <ConfirmationDialog
        isOpen={showFreeDeliveryWarning}
        title="Free Delivery Subscription"
        message="This feature is coming soon! Subscribe to get free delivery on all orders above the minimum order value. You'll be notified when this feature becomes available."
        confirmText="Got it"
        cancelText="Close"
        variant="info"
        onConfirm={() => setShowFreeDeliveryWarning(false)}
        onCancel={() => setShowFreeDeliveryWarning(false)}
      />
    </>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${
        active
          ? 'bg-white text-blue-600 shadow-md'
          : 'text-white/90 hover:bg-white/20 hover:text-white'
      }`}
    >
      <span className="flex items-center space-x-2">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
    </button>
  );
}

// Modern Layout Component with Top Navigation
function Tabs() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname.toLowerCase();
  const isHome = currentPath === '/home' || currentPath === '/';
  const isSearch = currentPath === '/search';
  const isProfile = currentPath === '/profile';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <TopNavBar />

      {/* Main Content */}
      <main className="w-full">
        {isHome && <HomeScreen />}
        {isSearch && <SearchScreen />}
        {isProfile && <ProfileScreen />}
      </main>
      <SideCartManager />
    </div>
  );
}

// Wrapper component for screens that need navigation bar
function WithNavBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar />
      <main className="w-full">{children}</main>
      <SideCartManager />
    </div>
  );
}

// Component to manage side cart state and auto-open when items are added
function SideCartManager() {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentShopId, setCurrentShopId] = React.useState<string | null>(null);
  
  // Use store directly instead of context to avoid provider dependency issues
  // The store is always available, while context requires CartProvider
  const shopCarts = useCartStore((state) => state.shopCarts);
  const shopId = useCartStore((state) => state.currentShopId);
  const getShopCart = useCartStore((state) => state.getShopCart);
  const prevShopCartsRef = React.useRef(shopCarts);
  const isInitialMount = React.useRef(true);
  const prevLocationRef = React.useRef(location.pathname);

  // Extract shopId from URL path (e.g., /shop/123 -> 123)
  const urlShopId = React.useMemo(() => {
    const match = location.pathname.match(/^\/shop\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  // Listen to cart changes and open side cart when items are added
  React.useEffect(() => {
    // Skip on initial mount to prevent opening on page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevShopCartsRef.current = shopCarts;
      return;
    }

    // Only auto-open cart if we're on a shop screen and the cart is for the current shop
    if (!urlShopId) {
      prevShopCartsRef.current = shopCarts;
      return;
    }

    const prevShopCarts = prevShopCartsRef.current;
    const currentCart = shopCarts[urlShopId];
    const prevCart = prevShopCarts[urlShopId];
    
    // Only handle cart changes for the shop we're currently viewing
    if (currentCart && currentCart.items.length > 0) {
      // Check if this is a new cart or items were added/changed
      if (!prevCart) {
        // New cart created - open for this shop
        setCurrentShopId(urlShopId);
      } else {
        // Check if items were added or quantities changed
        const prevTotalQuantity = prevCart.items.reduce((sum, item) => sum + item.quantity, 0);
        const currentTotalQuantity = currentCart.items.reduce((sum, item) => sum + item.quantity, 0);
        
        // Check if new items were added or quantities increased
        const hasNewItems = currentCart.items.length > prevCart.items.length;
        const hasQuantityIncrease = currentTotalQuantity > prevTotalQuantity;
        
        if (hasNewItems || hasQuantityIncrease) {
          // Open cart for the current shop
          setCurrentShopId(urlShopId);
        }
      }
    }

    prevShopCartsRef.current = shopCarts;
  }, [shopCarts, urlShopId]);

  // Update current shop when store's currentShopId changes (when items are added)
  React.useEffect(() => {
    // Only auto-open if we're on a shop screen and the cart is for the shop we're viewing
    if (shopId && urlShopId && shopId === urlShopId) {
      const shopCart = shopCarts[shopId];
      if (shopCart && shopCart.items.length > 0) {
        setCurrentShopId(shopId);
      }
    }
  }, [shopId, shopCarts, urlShopId]);

  // Close cart if current shop cart becomes empty
  React.useEffect(() => {
    if (currentShopId) {
      const shopCart = getShopCart(currentShopId);
      if (!shopCart || shopCart.items.length === 0) {
        setIsOpen(false);
        setCurrentShopId(null);
      }
    }
  }, [currentShopId, shopCarts, getShopCart]);

  // Switch cart when navigating between shop screens or close when leaving shop screen
  React.useEffect(() => {
    const currentPath = location.pathname;
    const prevPath = prevLocationRef.current;
    
    // If we're on a shop screen
    if (urlShopId) {
      // Check if we switched to a different shop
      const prevUrlShopId = prevPath.match(/^\/shop\/([^/]+)/)?.[1];
      if (prevUrlShopId && prevUrlShopId !== urlShopId) {
        // Switched to a different shop - set the new shop's cart but don't auto-open
        const newShopCart = getShopCart(urlShopId);
        if (newShopCart && newShopCart.items.length > 0) {
          setCurrentShopId(urlShopId);
          // Close cart when switching shops - user can hover to reopen
          setIsOpen(false);
        } else {
          // New shop has no items - close cart
          setIsOpen(false);
          setCurrentShopId(null);
        }
      } else if (!prevUrlShopId) {
        // Just entered a shop screen - set its cart but don't auto-open
        const shopCart = getShopCart(urlShopId);
        if (shopCart && shopCart.items.length > 0) {
          setCurrentShopId(urlShopId);
          // Don't auto-open, let user hover or add items to open it
          setIsOpen(false);
        } else {
          setCurrentShopId(null);
          setIsOpen(false);
        }
      } else {
        // Same shop - ensure we're showing the correct cart
        if (currentShopId !== urlShopId) {
          const shopCart = getShopCart(urlShopId);
          if (shopCart && shopCart.items.length > 0) {
            setCurrentShopId(urlShopId);
            // Keep cart state as is - don't change it
          } else {
            setCurrentShopId(null);
            setIsOpen(false);
          }
        }
      }
    } else {
      // Not on a shop screen - close cart
      if (isOpen) {
        setIsOpen(false);
      }
      setCurrentShopId(null);
    }
    
    prevLocationRef.current = currentPath;
  }, [location.pathname, urlShopId, currentShopId, isOpen, getShopCart]);

  // Listen for custom event to open cart for a specific shop (e.g., from hover on shop screen)
  React.useEffect(() => {
    const handleOpenShopCart = (event: CustomEvent) => {
      const shopId = event.detail?.shopId;
      // Only open cart if we're on the same shop screen and it has items
      if (shopId && urlShopId && shopId === urlShopId) {
        const shopCart = getShopCart(shopId);
        if (shopCart && shopCart.items.length > 0) {
          setCurrentShopId(shopId);
          setIsOpen(true);
        }
      }
    };

    const handleCloseShopCart = () => {
      setIsOpen(false);
      // Optionally clear currentShopId, but keep it so cart can reopen for same shop if needed
    };

    window.addEventListener('openShopCart', handleOpenShopCart as EventListener);
    window.addEventListener('closeShopCart', handleCloseShopCart as EventListener);
    return () => {
      window.removeEventListener('openShopCart', handleOpenShopCart as EventListener);
      window.removeEventListener('closeShopCart', handleCloseShopCart as EventListener);
    };
  }, [getShopCart, urlShopId]);

  // Only show cart if it's for the shop we're currently viewing
  const shouldShowCart = Boolean(urlShopId && currentShopId === urlShopId);
  
  return (
    <SideCart
      isOpen={isOpen && shouldShowCart}
      onClose={() => {
        setIsOpen(false);
        // Keep currentShopId so cart can reopen for same shop
      }}
      shopId={shouldShowCart ? currentShopId : null}
    />
  );
}

export default function WebNavigator() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient} context={undefined}>
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
              <OrderApprovalProvider>
                <BrowserRouter
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                  }}
                >
                  <NavigationWrapper>
                    <Routes>
                      <Route path="/" element={<Tabs />} />
                      <Route path="/home" element={<Tabs />} />
                      <Route path="/search" element={<Tabs />} />
                      <Route path="/profile" element={<Tabs />} />
                      <Route path="/cart" element={<WithNavBar><CheckoutScreen /></WithNavBar>} />
                      <Route path="/orders" element={<WithNavBar><OrdersScreen /></WithNavBar>} />
                      <Route path="/orderstatus" element={<WithNavBar><OrderStatusScreen /></WithNavBar>} />
                      <Route path="/favorites" element={<WithNavBar><FavoritesScreen /></WithNavBar>} />
                      <Route path="/help" element={<WithNavBar><HelpCenterScreen /></WithNavBar>} />
                      <Route path="/terms" element={<WithNavBar><TermsScreen /></WithNavBar>} />
                      <Route path="/feedback" element={<WithNavBar><FeedbackScreen /></WithNavBar>} />
                      <Route path="/login" element={<LoginScreen />} />
                      <Route path="/signup" element={<SignUpScreen />} />
                      <Route path="/auth/callback" element={<AuthCallbackScreen />} />
                      <Route path="/addresssearch" element={<AddressSearchScreen />} />
                      <Route path="/consumeraddressmanagement" element={<ConsumerAddressManagementScreen />} />
                      <Route path="/shop/:shopId" element={<WithNavBar><ShopDetailScreen /></WithNavBar>} />
                      <Route path="/merchantregistrationsurvey" element={<MerchantRegistrationSurveyScreen />} />
                      <Route path="/merchantdashboard" element={<MerchantDashboard />} />
                      <Route path="/merchantprofile" element={<MerchantProfileScreen />} />
                      <Route path="/createshop" element={
                        <div className="relative">
                          <MerchantDashboard />
                          <CreateShopScreen />
                        </div>
                      } />
                      <Route path="/editshop" element={<EditShopScreen />} />
                      <Route path="/viewshop" element={<ViewShopScreen />} />
                      <Route path="/shopaddressmap" element={<ShopAddressMapScreen />} />
                      <Route path="/merchantshopportal" element={<WithNavBar><MerchantShopPortalScreen /></WithNavBar>} />
                      <Route path="/managedeliveryareas" element={<ManageDeliveryAreasScreen />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    {/* Global post-delivery modals */}
                    <PostDeliveryModals />
                  </NavigationWrapper>
                </BrowserRouter>
              </OrderApprovalProvider>
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function PostDeliveryModals() {
  const {
    showThankYou,
    setShowThankYou,
    showReview,
    setShowReview,
    reviewOrder,
    setReviewOrder,
  } = useOrderApproval();
  const location = useLocation();
  const navigate = useNavigate();

  // Do not show consumer thank-you / review modals on merchant routes
  const pathname = location.pathname.toLowerCase();
  if (
    pathname.startsWith('/merchant') ||
    pathname.startsWith('/createshop') ||
    pathname.startsWith('/editshop') ||
    pathname.startsWith('/viewshop') ||
    pathname.startsWith('/shopaddressmap') ||
    pathname.startsWith('/managedeliveryareas')
  ) {
    return null;
  }

  if (!reviewOrder) return null;

  return (
    <>
      <ThankYouOrderModal
        order={reviewOrder}
        isOpen={showThankYou}
        onClose={() => {
          setShowThankYou(false);
          setShowReview(true);
        }}
      />
      <ReviewRatingModal
        order={reviewOrder}
        isOpen={showReview}
        onClose={() => {
          setShowReview(false);
          setReviewOrder(null);
          // Navigate to home - shops will auto-refetch on navigation
          if (location.pathname !== '/home') {
            navigate('/home', { replace: true });
          }
        }}
        onSubmitted={() => {
          setShowReview(false);
          setReviewOrder(null);
          // Navigate to home - shops will auto-refetch on navigation
          if (location.pathname !== '/home') {
            navigate('/home', { replace: true });
          }
        }}
      />
    </>
  );
}

