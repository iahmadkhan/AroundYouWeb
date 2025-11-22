import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WebMap from '../../components/WebMap';
import { useUserLocation } from '../../../../src/hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../../../src/context/LocationContext';
import { useAuth } from '../../../../src/context/AuthContext';
import * as addressService from '../../../../src/services/consumer/addressService';
import { useGeoapifyAutocomplete, SearchResult } from '../../../../src/hooks/useLocationQueries';

export default function AddressSearchScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as any;
  const editingAddress = locationState?.address;
  const initialCoords = locationState?.initialCoords;
  const initialAddress = locationState?.initialAddress;
  const { coords: userCoords, addressLine: userAddressLine, loading: userLocationLoading } = useUserLocation();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();
  const { user } = useAuth();
  
  const mapRef = useRef<any>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [markerOffsetY, setMarkerOffsetY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reverseGeocode, setReverseGeocode] = useState<{
    formatted: string;
    city?: string;
    region?: string;
    streetLine?: string;
  } | null>(null);
  const [landmark, setLandmark] = useState('');
  const [selectedTitle, setSelectedTitle] = useState<addressService.AddressTitle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetMode, setSheetMode] = useState<'search' | 'confirm' | 'details'>('search');
  const hasLoadedInitialLocationRef = useRef(false);
  
  const [mapRegion, setMapRegion] = useState({
    latitude: initialCoords?.latitude || editingAddress?.latitude || selectedAddress?.coords?.latitude || userCoords?.latitude || 31.451483,
    longitude: initialCoords?.longitude || editingAddress?.longitude || selectedAddress?.coords?.longitude || userCoords?.longitude || 74.435203,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const lastRegionRef = useRef<{ latitude: number; longitude: number } | null>({
    latitude: initialCoords?.latitude || editingAddress?.latitude || selectedAddress?.coords?.latitude || userCoords?.latitude || 31.451483,
    longitude: initialCoords?.longitude || editingAddress?.longitude || selectedAddress?.coords?.longitude || userCoords?.longitude || 74.435203,
  });
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search query to avoid too many API calls
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const { data: searchResults = [], isLoading: isSearching } = useGeoapifyAutocomplete(
    debouncedSearchQuery,
    debouncedSearchQuery.trim().length >= 2 && showSearchResults,
    mapRegion
  );


  useEffect(() => {
    if (editingAddress) {
      hasLoadedInitialLocationRef.current = true; // Mark as loaded to prevent auto-location
      const coords = {
        latitude: editingAddress.latitude,
        longitude: editingAddress.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(coords);
      lastRegionRef.current = { latitude: coords.latitude, longitude: coords.longitude };
      setLandmark(editingAddress.landmark || '');
      setSelectedTitle(editingAddress.title || null);
      setReverseGeocode({
        formatted: editingAddress.formatted_address || editingAddress.street_address,
        city: editingAddress.city || '',
        region: editingAddress.region || undefined,
        streetLine: editingAddress.street_address,
      });
      setSheetMode('confirm');
    } else if (initialCoords && initialAddress) {
      hasLoadedInitialLocationRef.current = true; // Mark as loaded to prevent auto-location
      // Handle initial coordinates from landing page
      const coords = {
        latitude: initialCoords.latitude,
        longitude: initialCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(coords);
      lastRegionRef.current = { latitude: coords.latitude, longitude: coords.longitude };
      setSearchQuery(initialAddress);
      
      // Parse address to extract city and street
      const addressParts = initialAddress.split(',').map((p: string) => p.trim());
      const cityParts = addressParts.filter((part: string) => {
        const lower = part.toLowerCase();
        return !/\d{4,}/.test(part) && !['pakistan', 'pk', 'usa', 'uk'].includes(lower) && part.length > 2;
      });
      const city = cityParts.length > 1 ? cityParts[1] : cityParts[0] || '';
      
      setReverseGeocode({
        formatted: initialAddress,
        city,
        region: undefined,
        streetLine: addressParts[0] || '',
      });
      setSheetMode('confirm');
      
      // Animate map to location
      if (mapRef.current?.animateCamera) {
        mapRef.current.animateCamera(
          { center: { latitude: coords.latitude, longitude: coords.longitude }, zoom: 16 },
          { duration: 500 }
        );
      }
    }
  }, [editingAddress, initialCoords, initialAddress]);

  const endDragging = (regionHint?: { latitude: number; longitude: number }) => {
    const finalCoords = regionHint || lastRegionRef.current || {
      latitude: mapRegion.latitude,
      longitude: mapRegion.longitude,
    };

    lastRegionRef.current = finalCoords;
    setIsMoving(false);
    setMarkerOffsetY(0);

    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
    reverseDebounceRef.current = setTimeout(async () => {
      try {
        const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${finalCoords.latitude}&lon=${finalCoords.longitude}&format=json&apiKey=${geoapifyKey}`;
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
          setReverseGeocode({
            formatted: full,
            city: (city || district || '') as string,
            region: (state || '') as string,
            streetLine,
          });
          if (sheetMode === 'search') {
            setSheetMode('confirm');
          }
        }
      } catch (_) {}
    }, 800); // Reduced from 1000ms to 800ms for faster response
  };

  const handleRegionChangeComplete = (region: any) => {
    if (region?.latitude && region?.longitude) {
      setMapRegion(region);
      lastRegionRef.current = { latitude: region.latitude, longitude: region.longitude };
      endDragging({ latitude: region.latitude, longitude: region.longitude });
    }
  };

  const handleMapTouchStart = () => {
    setIsMoving(true);
    setMarkerOffsetY(-12);
  };

  const handleMapTouchEnd = () => {
    setTimeout(() => {
      const finalCoords = lastRegionRef.current || {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      };
      endDragging(finalCoords);
    }, 150);
  };

  // Load initial location when screen first opens (first time only)
  useEffect(() => {
    // Skip if already loaded, editing address, or has initial coords
    if (hasLoadedInitialLocationRef.current || editingAddress || initialCoords) {
      return;
    }

    // Wait for user location to load
    if (userLocationLoading) {
      return;
    }

    // If we have user coordinates, use them
    if (userCoords && !hasLoadedInitialLocationRef.current) {
      hasLoadedInitialLocationRef.current = true;
      
      const coords = {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setMapRegion(coords);
      lastRegionRef.current = { latitude: coords.latitude, longitude: coords.longitude };
      
      // If we have address line from useUserLocation, use it
      if (userAddressLine) {
        setSearchQuery(userAddressLine);
        
        // Parse address to extract city and street
        const addressParts = userAddressLine.split(',').map((p: string) => p.trim());
        const cityParts = addressParts.filter((part: string) => {
          const lower = part.toLowerCase();
          return !/\d{4,}/.test(part) && !['pakistan', 'pk', 'usa', 'uk'].includes(lower) && part.length > 2;
        });
        const city = cityParts.length > 1 ? cityParts[1] : cityParts[0] || '';
        
        setReverseGeocode({
          formatted: userAddressLine,
          city,
          region: undefined,
          streetLine: addressParts[0] || '',
        });
        setSheetMode('confirm');
      } else {
        // Reverse geocode to get address
        endDragging(coords);
      }
      
      // Animate map to location
      setTimeout(() => {
        if (mapRef.current?.animateCamera) {
          mapRef.current.animateCamera(
            { center: { latitude: coords.latitude, longitude: coords.longitude }, zoom: 16 },
            { duration: 500 }
          );
        }
      }, 100);
    }
  }, [userCoords, userAddressLine, userLocationLoading, editingAddress, initialCoords]);

  const handleSelectResult = (result: SearchResult) => {
    setShowSearchResults(false);
    setSearchQuery('');
    const coords = result.coords;
    setMapRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    lastRegionRef.current = coords;
    mapRef.current?.animateCamera?.(
      { center: { latitude: coords.latitude, longitude: coords.longitude }, zoom: 16 },
      { duration: 500 }
    );
    setReverseGeocode({
      formatted: result.address,
      city: result.address.split(',')[1]?.trim() || '',
      streetLine: result.name,
    });
    setSheetMode('confirm');
  };

  const handlePinpointLocation = async () => {
    // Get current map center
    if (mapRef.current?.getCamera) {
      const camera = await mapRef.current.getCamera();
      const center = camera?.center || lastRegionRef.current || mapRegion;
      
      if (center) {
        // Zoom in to level 20 for precise pinpointing
        if (mapRef.current?.animateCamera) {
          mapRef.current.animateCamera(
            { 
              center: { 
                latitude: center.latitude || center.lat || mapRegion.latitude, 
                longitude: center.longitude || center.lng || mapRegion.longitude 
              }, 
              zoom: 20 
            },
            { duration: 500 }
          );
        }
      }
    } else if (lastRegionRef.current) {
      // Fallback: use last known region
      if (mapRef.current?.animateCamera) {
        mapRef.current.animateCamera(
          { 
            center: { 
              latitude: lastRegionRef.current.latitude, 
              longitude: lastRegionRef.current.longitude 
            }, 
            zoom: 20 
          },
          { duration: 500 }
        );
      }
    }
  };

  const handleConfirmAddress = () => {
    // Quick confirm - just update location without saving to address book
    if (lastRegionRef.current && reverseGeocode) {
      setSelectedAddress({
        label: reverseGeocode.streetLine || reverseGeocode.city || reverseGeocode.formatted,
        city: reverseGeocode.city || '',
        coords: lastRegionRef.current,
        isCurrent: false,
        addressId: editingAddress?.id ?? null,
      });
      navigate('/home');
    }
  };

  const handleSaveAddress = async () => {
    if (!user || !lastRegionRef.current) return;
    
    setIsSaving(true);
    try {
      const addressData = {
        street_address: reverseGeocode?.streetLine || reverseGeocode?.formatted || '',
        city: reverseGeocode?.city || '',
        region: reverseGeocode?.region || '',
        formatted_address: reverseGeocode?.formatted || '',
        latitude: lastRegionRef.current.latitude,
        longitude: lastRegionRef.current.longitude,
        landmark: landmark || undefined,
        title: selectedTitle || undefined,
      };

      let savedAddressId: string | null = editingAddress?.id ?? null;
      if (editingAddress?.id) {
        const result = await addressService.updateAddress(editingAddress.id, addressData);
        if (result.error) {
          alert(result.error.message || 'Failed to save address');
          return;
        }
        savedAddressId = result.data?.id ?? editingAddress.id;
      } else {
        const result = await addressService.createAddress(addressData);
        if (result.error) {
          alert(result.error.message || 'Failed to save address');
          return;
        }
        savedAddressId = result.data?.id ?? null;
      }

      setSelectedAddress({
        label: reverseGeocode?.streetLine || reverseGeocode?.city || reverseGeocode?.formatted || '',
        city: reverseGeocode?.city || '',
        coords: lastRegionRef.current,
        isCurrent: false,
        addressId: savedAddressId,
      });
      navigate(-1);
    } catch (err: any) {
      alert(err.message || 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const sheetHeight = sheetMode === 'search' ? '50%' : sheetMode === 'confirm' ? '30%' : '45%';

  return (
    <div className="flex-1 bg-white relative" style={{ height: '100vh' }}>
      <WebMap
        mapRef={mapRef}
        initialRegion={mapRegion}
        onTouchStart={handleMapTouchStart}
        onRegionChangeComplete={handleRegionChangeComplete}
        onTouchEnd={handleMapTouchEnd}
        isMoving={isMoving}
        markerOffsetY={markerOffsetY}
      />

      {/* Pinpoint Location Button - Floating on map - Always visible */}
      <button
        onClick={handlePinpointLocation}
        className="absolute top-20 right-4 z-50 bg-white hover:bg-gray-50 text-gray-700 shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 border border-gray-200 transition-all hover:shadow-xl"
        title="Pinpoint Location - Zoom in for precise selection"
      >
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2"/>
          <circle cx="12" cy="12" r="3" strokeWidth="2"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
        <span className="text-sm font-medium">Pinpoint</span>
      </button>

      {/* Confirm Address Button - Floating on map - Shows when location is selected */}
      {lastRegionRef.current && (
        <div 
          className={`absolute left-1/2 transform -translate-x-1/2 z-[60] flex flex-col gap-2 items-center ${sheetMode === 'search' ? 'bottom-20' : 'bottom-32'}`}
          style={{ pointerEvents: 'auto' }}
        >
          {reverseGeocode ? (
            <>
              <button
                onClick={handleConfirmAddress}
                className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl rounded-full px-6 py-3 flex items-center gap-2 whitespace-nowrap border border-blue-400/30 hover:from-blue-700 hover:to-blue-600 transition-all font-semibold"
                title="Confirm and use this address"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-bold tracking-wide drop-shadow-sm">Confirm Address</span>
              </button>
              {user && (
                <button
                  onClick={() => setSheetMode('details')}
                  className="bg-white text-blue-600 shadow-lg rounded-full px-5 py-2.5 flex items-center gap-2 whitespace-nowrap border-2 border-blue-600 hover:bg-blue-50 transition-all font-semibold text-sm"
                  title="Save to address book"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>Save Address</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleConfirmAddress}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl rounded-full px-6 py-3 flex items-center gap-2 whitespace-nowrap border border-blue-400/30 hover:from-blue-700 hover:to-blue-600 transition-all font-semibold opacity-75"
              title="Confirm location (address will be fetched)"
              disabled
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-bold tracking-wide drop-shadow-sm">Confirm Address</span>
            </button>
          )}
        </div>
      )}

      {/* Compact Search Bar at Top */}
      {sheetMode === 'search' && (
        <div className="absolute top-4 left-4 right-4 z-40">
          <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-900 text-xl smooth-transition"
            >
              ←
            </button>
            <span className="text-gray-400 text-xl">🔍</span>
            <input
              type="text"
              className="flex-1 text-gray-900 text-base bg-transparent border-none outline-none placeholder-gray-400"
              placeholder="Search for address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(e.target.value.trim().length >= 2);
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl smooth-transition"
              >
                ✕
              </button>
            )}
            {isSearching && (
              <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full smooth-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="mt-2 bg-white rounded-2xl shadow-lg max-h-64 overflow-y-auto fade-in">
              {searchResults.map((item, index) => (
                <button
                  key={item.id}
                  className="w-full text-left py-3 px-4 border-b border-gray-100 hover:bg-gray-50 smooth-transition first:rounded-t-2xl last:rounded-b-2xl last:border-b-0"
                  onClick={() => handleSelectResult(item)}
                  style={{
                    animationDelay: `${index * 0.05}s`,
                    animationFillMode: 'both',
                  }}
                >
                  <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{item.address}</div>
                </button>
              ))}
            </div>
          )}
          {showSearchResults && isSearching && searchResults.length === 0 && (
            <div className="mt-2 bg-white rounded-2xl shadow-lg p-4 text-center">
              <div className="w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full smooth-spinner mx-auto" style={{ width: '24px', height: '24px', borderWidth: '2px' }} />
              <p className="text-gray-600 text-sm mt-2">Searching...</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Sheet - Only for confirm/details modes */}
      {(sheetMode === 'confirm' || sheetMode === 'details') && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-30 slide-up"
          style={{ 
            height: sheetHeight, 
            maxHeight: '90vh',
            transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'height',
          }}
        >
          <div className="h-full flex flex-col">
            {/* Drag Handle */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-4" />

            {sheetMode === 'confirm' && reverseGeocode && (
            <div className="flex-1 flex flex-col px-4">
              <div className="mb-4">
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  {reverseGeocode.streetLine || reverseGeocode.city || 'Selected location'}
                </div>
                <div className="text-sm text-gray-600">{reverseGeocode.formatted}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700"
                  onClick={() => {
                    // Quick use - just update location without saving to address book
                    if (lastRegionRef.current) {
                      setSelectedAddress({
                        label: reverseGeocode.streetLine || reverseGeocode.city || reverseGeocode.formatted,
                        city: reverseGeocode.city || '',
                        coords: lastRegionRef.current,
                        isCurrent: false,
                      });
                      navigate('/home');
                    }
                  }}
                >
                  Use This Location
                </button>
                {user && (
                  <button
                    className="bg-white text-blue-600 py-3 px-6 rounded-xl font-semibold border-2 border-blue-600 hover:bg-blue-50"
                    onClick={() => setSheetMode('details')}
                  >
                    Save to Address Book
                  </button>
                )}
              </div>
            </div>
          )}

            {sheetMode === 'details' && (
            <div className="flex-1 flex flex-col px-4 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Landmark (Optional)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200"
                  placeholder="e.g., Near Main Gate"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Save as</label>
                <div className="flex gap-2 flex-wrap">
                  {(['home', 'office'] as addressService.AddressTitle[]).map((title) => (
                    <button
                      key={title}
                      className={`px-4 py-2 rounded-xl border ${
                        selectedTitle === title
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                      onClick={() => setSelectedTitle(title)}
                    >
                      {title === 'home' ? 'Home' : title === 'office' ? 'Office' : title}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className={`bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 smooth-transition ${
                  isSaving ? 'button-loading' : ''
                }`}
                onClick={handleSaveAddress}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

