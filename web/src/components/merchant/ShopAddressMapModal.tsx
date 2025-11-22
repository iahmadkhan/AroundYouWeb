import React, { useState, useRef, useEffect } from 'react';
import WebMap from '../WebMap';
import { useGeoapifyAutocomplete, SearchResult } from '../../../../src/hooks/useLocationQueries';
import PinMarker from '../../../../src/icons/PinMarker';
import CenterHairline from '../../../../src/icons/CenterHairline';

const PAKISTAN_CENTER = {
  latitude: 31.451483,
  longitude: 74.435203,
};

interface ShopAddressMapModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (address: {
    formatted: string;
    address: string;
    streetLine?: string;
    city?: string;
    region?: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialAddress?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  readOnly?: boolean; // For view-only mode
  title?: string; // Custom title for the modal
}

export default function ShopAddressMapModal({
  visible,
  onClose,
  onConfirm,
  initialAddress,
  initialLatitude,
  initialLongitude,
  readOnly = false,
  title = 'Select shop location',
}: ShopAddressMapModalProps) {
  const mapRef = useRef<any>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [markerOffsetY, setMarkerOffsetY] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialAddress || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reverseGeocode, setReverseGeocode] = useState<{
    formatted: string;
    city?: string;
    region?: string;
    streetLine?: string;
  } | null>(null);

  const [mapRegion, setMapRegion] = useState({
    latitude: initialLatitude || PAKISTAN_CENTER.latitude,
    longitude: initialLongitude || PAKISTAN_CENTER.longitude,
    latitudeDelta: 0.005, // Higher zoom for precise location
    longitudeDelta: 0.005,
  });

  const lastRegionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        }
      } catch (_) {}
    }, 800);
  };

  // Initialize with provided coordinates
  useEffect(() => {
    if (visible && initialLatitude && initialLongitude) {
      const coords = {
        latitude: initialLatitude,
        longitude: initialLongitude,
        latitudeDelta: 0.005, // Higher zoom for precise location
        longitudeDelta: 0.005,
      };
      setMapRegion(coords);
      lastRegionRef.current = { latitude: initialLatitude, longitude: initialLongitude };
      
      // Animate map to the location when modal opens with higher zoom for precise location
      if (mapRef.current?.animateCamera) {
        setTimeout(() => {
          mapRef.current.animateCamera(
            { center: { latitude: initialLatitude, longitude: initialLongitude }, zoom: 18 },
            { duration: 500 }
          );
        }, 100);
      }
      
      if (initialAddress) {
        setReverseGeocode({
          formatted: initialAddress,
          streetLine: initialAddress.split(',')[0] || '',
          city: initialAddress.split(',')[1]?.trim() || '',
        });
        setSearchQuery(initialAddress);
      } else {
        // If no address provided, do reverse geocode to get address for the INITIAL coordinates only
        // Don't auto-update if user is editing - only reverse geocode the provided initial location
        setTimeout(() => {
          endDragging({ latitude: initialLatitude, longitude: initialLongitude });
        }, 500);
      }
    } else if (visible) {
      // Reset to default when modal opens without initial coordinates
      setSearchQuery('');
      setReverseGeocode(null);
      lastRegionRef.current = null;
    }
  }, [visible, initialLatitude, initialLongitude, initialAddress]);

  // Debounce search query
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const { data: searchResults = [], isLoading: isSearching } = useGeoapifyAutocomplete(
    debouncedSearchQuery,
    debouncedSearchQuery.trim().length >= 2 && showSearchResults,
    mapRegion
  );

  const handleRegionChangeComplete = (region: any) => {
    if (region?.latitude && region?.longitude) {
      setMapRegion(region);
      lastRegionRef.current = { latitude: region.latitude, longitude: region.longitude };
      // Only do reverse geocoding if user isn't manually editing the search query
      if (!isManuallyEditingRef.current) {
        endDragging({ latitude: region.latitude, longitude: region.longitude });
      }
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
      // Only do reverse geocoding if user isn't manually editing the search query
      if (!isManuallyEditingRef.current) {
        endDragging(finalCoords);
      }
    }, 150);
  };

  const handleSelectResult = (result: SearchResult) => {
    setShowSearchResults(false);
    setSearchQuery('');
    const coords = result.coords;
    setMapRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.005, // Higher zoom for precise location
      longitudeDelta: 0.005,
    });
    lastRegionRef.current = coords;
    mapRef.current?.animateCamera?.(
      { center: { latitude: coords.latitude, longitude: coords.longitude }, zoom: 18 },
      { duration: 500 }
    );
    setReverseGeocode({
      formatted: result.address,
      city: result.address.split(',')[1]?.trim() || '',
      streetLine: result.name,
    });
    setSearchQuery(result.address);
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

  const handleConfirm = () => {
    if (!lastRegionRef.current || !reverseGeocode) {
      alert('Please select a location on the map');
      return;
    }
    // Save the location data
    const locationData = {
      formatted: reverseGeocode.formatted,
      address: reverseGeocode.formatted,
      streetLine: reverseGeocode.streetLine,
      city: reverseGeocode.city,
      region: reverseGeocode.region,
      latitude: lastRegionRef.current.latitude,
      longitude: lastRegionRef.current.longitude,
    };
    
    // Call onConfirm to save the location (this will update state and close modals)
    onConfirm(locationData);
    // Close this modal - onConfirm should handle closing, but we ensure it's closed
    onClose();
  };

  // Track if user is manually editing the search query
  const isManuallyEditingRef = useRef(false);
  
  // Update search query when reverse geocode changes, but only if user isn't manually editing
  useEffect(() => {
    if (reverseGeocode?.formatted && !isManuallyEditingRef.current) {
      setSearchQuery(reverseGeocode.formatted);
    }
  }, [reverseGeocode]);

  if (!visible) return null;

  return (
    <>
      {/* Overlay to close map modal - Behind modal */}
      <div 
        className="fixed inset-0 z-[65] bg-black/30" 
        onClick={onClose}
        style={{ backdropFilter: 'none', pointerEvents: 'auto' }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none" style={{ backdropFilter: 'none' }}>
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          style={{ 
            maxHeight: '90vh',
            transform: 'translateZ(0)',
            willChange: 'auto',
            opacity: 1
          }}
        >
        {/* Blue Header with Address */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-6 py-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <span className="text-white font-medium text-sm flex-1 truncate">
          {reverseGeocode?.formatted || searchQuery || title}
        </span>
        <button
          onClick={onClose}
          className="text-white/90 hover:text-white transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Address Input Section */}
          <div className="px-6 pt-4 pb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Enter your address
            </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              className="w-full px-4 py-3 pr-20 text-base text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter shop location..."
              value={searchQuery}
              onChange={(e) => {
                if (!readOnly) {
                  isManuallyEditingRef.current = true; // Mark that user is manually editing
                  setSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.trim().length >= 2);
                  // Reset the flag after a delay to allow reverse geocoding again when user stops typing
                  setTimeout(() => {
                    isManuallyEditingRef.current = false;
                  }, 2000);
                }
              }}
              onFocus={() => {
                if (!readOnly) {
                  isManuallyEditingRef.current = true; // Mark that user is editing
                  if (searchQuery.trim().length >= 2) {
                    setShowSearchResults(true);
                  }
                }
              }}
              onBlur={() => {
                // Reset flag after a delay when user leaves the input
                setTimeout(() => {
                  isManuallyEditingRef.current = false;
                }, 500);
              }}
              readOnly={readOnly}
              disabled={readOnly}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery.length > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
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
              <div className="h-5 w-px bg-gray-300"></div>
              <button
                onClick={async () => {
                  if (!navigator.geolocation) {
                    alert('Geolocation is not supported by your browser');
                    return;
                  }

                  // Show loading state
                  setIsLocating(true);

                  try {
                    // Get current position with better options for accuracy
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                      // Use watchPosition for better accuracy, but with a timeout
                      let watchId: number | null = null;
                      const timeoutId = setTimeout(() => {
                        if (watchId !== null) {
                          navigator.geolocation.clearWatch(watchId);
                        }
                        // Fallback to getCurrentPosition if watchPosition times out
                        navigator.geolocation.getCurrentPosition(
                          resolve,
                          reject,
                          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                        );
                      }, 5000);

                      watchId = navigator.geolocation.watchPosition(
                        (pos) => {
                          // Check accuracy - only accept if accuracy is reasonable (within 100 meters)
                          if (pos.coords.accuracy && pos.coords.accuracy <= 100) {
                            clearTimeout(timeoutId);
                            if (watchId !== null) {
                              navigator.geolocation.clearWatch(watchId);
                            }
                            resolve(pos);
                          } else if (pos.coords.accuracy && pos.coords.accuracy > 100 && pos.coords.accuracy <= 500) {
                            // Accept if accuracy is within 500m (still reasonable)
                            clearTimeout(timeoutId);
                            if (watchId !== null) {
                              navigator.geolocation.clearWatch(watchId);
                            }
                            resolve(pos);
                          }
                          // If accuracy is too poor, continue watching
                        },
                        (err) => {
                          clearTimeout(timeoutId);
                          if (watchId !== null) {
                            navigator.geolocation.clearWatch(watchId);
                          }
                          reject(err);
                        },
                        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                      );
                    });

                    // Validate coordinates
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    // Basic validation - check if coordinates are reasonable (Pakistan bounds approximately)
                    if (lat < 23 || lat > 37 || lng < 60 || lng > 78) {
                      alert('Location seems inaccurate. Please try again or enter address manually.');
                      setIsLocating(false);
                      return;
                    }

                    // Reverse geocode with better error handling
                    const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
                    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${geoapifyKey}&lang=en`;
                    
                    const res = await fetch(url);
                    const json = await res.json();
                    
                    if (json?.results?.length > 0) {
                      // Find the most accurate result (prefer results with street/house number)
                      const result = json.results.find((r: any) => r.street || r.housenumber) || json.results[0];
                      
                      const street = result?.street || '';
                      const houseNumber = result?.housenumber || '';
                      const district = result?.district || result?.suburb || '';
                      const city = result?.city || '';
                      const state = result?.state || '';
                      const streetLine = [houseNumber, street].filter(Boolean).join(' ') || district || city || 'Street address';
                      const full = result?.formatted || [streetLine, city, state].filter(Boolean).join(', ');
                      
                      setSearchQuery(full);
                      setMapRegion({
                        latitude: lat,
                        longitude: lng,
                        latitudeDelta: 0.005, // Higher zoom for precise location
                        longitudeDelta: 0.005,
                      });
                      lastRegionRef.current = { latitude: lat, longitude: lng };
                      
                      if (mapRef.current?.animateCamera) {
                        mapRef.current.animateCamera(
                          { center: { latitude: lat, longitude: lng }, zoom: 18 },
                          { duration: 500 }
                        );
                      }
                      
                      endDragging({ latitude: lat, longitude: lng });
                    } else {
                      alert('Could not find address for this location. Please try again.');
                    }
                  } catch (error: any) {
                    console.error('Location error:', error);
                    if (error.code === 1) {
                      alert('Location access denied. Please enable location permissions and try again.');
                    } else if (error.code === 2) {
                      alert('Location unavailable. Please check your GPS settings and try again.');
                    } else if (error.code === 3) {
                      alert('Location request timed out. Please try again.');
                    } else {
                      alert('Failed to get your location. Please try again or enter address manually.');
                    }
                  } finally {
                    setIsLocating(false);
                  }
                }}
                disabled={isLocating}
                className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Locate Me"
              >
                {isLocating ? (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <span className="hidden sm:inline text-xs">Locate</span>
              </button>
            </div>
          </div>
        </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchQuery.trim().length >= 2 && !readOnly && (
              <div className="px-6 pb-2">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50">
                  {isSearching && (
                    <div className="px-5 py-8 text-center">
                      <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-gray-500 text-sm">Searching...</p>
                    </div>
                  )}
                  
                  {!isSearching && searchResults.length > 0 && (
                    <div>
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full text-left py-3 px-4 border-b border-gray-100 hover:bg-blue-50 transition-colors flex items-start gap-3"
                          onClick={() => handleSelectResult(item)}
                        >
                          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-semibold text-gray-900 truncate">{item.name}</div>
                            <div className="text-sm text-gray-600 mt-0.5 line-clamp-2">{item.address}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!isSearching && searchResults.length === 0 && (
                    <div className="px-5 py-8 text-center">
                      <p className="text-gray-500 text-sm">No locations found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Map */}
            <div className="px-6 pb-4">
              <div 
                className="relative rounded-xl overflow-hidden border border-gray-200" 
                style={{ 
                  height: '450px',
                  transform: 'translateZ(0)',
                  willChange: 'auto',
                  backfaceVisibility: 'hidden',
                  opacity: 1
                }}
              >
                <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
                  <WebMap
                    mapRef={mapRef}
                    initialRegion={mapRegion}
                    onTouchStart={handleMapTouchStart}
                    onRegionChangeComplete={handleRegionChangeComplete}
                    onTouchEnd={handleMapTouchEnd}
                    isMoving={isMoving}
                    markerOffsetY={markerOffsetY}
                    showDeliveryLabel={false}
                  />
                </div>

                {/* Pinpoint Location Button - Floating on map */}
                {reverseGeocode && !readOnly && (
                  <button
                    onClick={handlePinpointLocation}
                    className="absolute top-4 right-4 z-50 bg-white hover:bg-gray-50 text-gray-700 shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 border border-gray-200 transition-all hover:shadow-xl"
                    title="Pinpoint Location - Zoom in for precise selection"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                    <span className="text-sm font-medium">Pinpoint</span>
                  </button>
                )}

                {/* Centered Marker and Confirmation Button Overlay */}
                <div className="absolute pointer-events-none" style={{ left: '50%', top: '50%', transform: `translate(-50%, calc(-100% + ${markerOffsetY}px))`, zIndex: 10, pointerEvents: 'none' }}>
                  <div className="flex flex-col items-center">
                    {/* Save and Continue Button - Shop location style */}
                    {reverseGeocode && !readOnly && (
                      <button
                        onClick={handleConfirm}
                        className="pointer-events-auto mb-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap animate-pulse-subtle border border-blue-400/30 hover:from-blue-700 hover:to-blue-600 transition-all"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-bold tracking-wide drop-shadow-sm">Save and Continue</span>
                      </button>
                    )}
                    {reverseGeocode && readOnly && (
                      <div className="pointer-events-auto mb-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap border border-gray-300">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-bold tracking-wide">Shop Location</span>
                      </div>
                    )}
                    {/* Pin Marker */}
                    <PinMarker size={36} color="#3B82F6" />
                    {/* Hairline when moving */}
                    {isMoving && (
                      <div className="mt-0.5">
                        <CenterHairline height={22} color="#3B82F6" opacity={0.9} strokeWidth={1.5} dashArray="2,2" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

