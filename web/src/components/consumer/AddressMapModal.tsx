import React, { useState, useRef, useEffect } from 'react';
import WebMap from '../WebMap';
import { useAuth } from '../../../../src/context/AuthContext';
import * as addressService from '../../../../src/services/consumer/addressService';

const PAKISTAN_CENTER = {
  latitude: 31.451483,
  longitude: 74.435203,
};

interface AddressMapModalProps {
  visible: boolean;
  onClose: () => void;
  onUseLocation?: (address: {
    label: string;
    city: string;
    coords: { latitude: number; longitude: number };
  }) => void;
  onSaveAddress?: () => void;
  showSaveOption?: boolean;
  initialAddress?: string;
  initialLatitude?: number;
  initialLongitude?: number;
}

export default function AddressMapModal({
  visible,
  onClose,
  onUseLocation,
  onSaveAddress,
  showSaveOption = false,
  initialAddress,
  initialLatitude,
  initialLongitude,
}: AddressMapModalProps) {
  const { user } = useAuth();
  const mapRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState(initialAddress || '');
  const [isLocatingInModal, setIsLocatingInModal] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialLatitude && initialLongitude
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null
  );
  const [reverseGeocodeResult, setReverseGeocodeResult] = useState<{
    formatted: string;
    city?: string;
    region?: string;
    streetLine?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [landmark, setLandmark] = useState('');
  const [selectedTitle, setSelectedTitle] = useState<addressService.AddressTitle>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [existingAddresses, setExistingAddresses] = useState<addressService.ConsumerAddress[]>([]);
  const [titleConflictMessage, setTitleConflictMessage] = useState<string | null>(null);

  const DEFAULT_ADDRESS = 'New address Service Road W Islamabad';

  useEffect(() => {
    if (visible && initialLatitude && initialLongitude) {
      setMapCoords({ latitude: initialLatitude, longitude: initialLongitude });
      // Reverse geocode initial location
      reverseGeocodeLocation(initialLatitude, initialLongitude);
    } else if (visible && !mapCoords) {
      setMapCoords(PAKISTAN_CENTER);
    }
  }, [visible, initialLatitude, initialLongitude]);

  // Fetch existing addresses when modal opens
  useEffect(() => {
    if (visible && user) {
      fetchExistingAddresses();
    } else if (!visible) {
      // Reset form when modal closes
      setLandmark('');
      setSelectedTitle(null);
      setCustomTitle('');
      setShowOtherInput(false);
      setShowDetailsForm(false);
      setTitleConflictMessage(null);
    }
  }, [visible, user]);

  const fetchExistingAddresses = async () => {
    if (!user) return;
    try {
      const { data, error } = await addressService.getUserAddresses();
      if (!error && data) {
        setExistingAddresses(data);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    }
  };

  const reverseGeocodeLocation = async (lat: number, lon: number) => {
    try {
      const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&format=json&apiKey=${geoapifyKey}`;
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
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      setReverseGeocodeResult(null);
    }
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
          const newCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setMapCoords(newCoords);
          await reverseGeocodeLocation(newCoords.latitude, newCoords.longitude);

          // Animate map to current location
          if (mapRef.current?.animateCamera) {
            mapRef.current.animateCamera({
              center: newCoords,
              zoom: 16,
            }, { duration: 1000 });
          }

          setIsLocatingInModal(false);
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

  const handleUseLocation = () => {
    if (!mapCoords) return;
    const addressLabel = reverseGeocodeResult?.formatted || reverseGeocodeResult?.streetLine || searchQuery || 'Selected location';
    const city = reverseGeocodeResult?.city || '';
    
    if (onUseLocation) {
      onUseLocation({
        label: addressLabel,
        city: city,
        coords: mapCoords,
      });
    }
    onClose();
  };

  const checkTitleConflict = (title: addressService.AddressTitle): boolean => {
    if (!title) return false;
    return existingAddresses.some(addr => addr.title === title);
  };

  const handleTitleSelection = (title: 'home' | 'office' | 'other') => {
    setTitleConflictMessage(null);
    if (title === 'other') {
      setShowOtherInput(true);
      setSelectedTitle(null);
      setCustomTitle('');
    } else {
      setShowOtherInput(false);
      setCustomTitle('');
      if (checkTitleConflict(title)) {
        setTitleConflictMessage(`Address with title "${title}" already exists. Please choose a different title or update the existing one.`);
        return;
      }
      setSelectedTitle(title);
    }
  };

  const handleSaveAddress = async () => {
    if (!user || !mapCoords || !reverseGeocodeResult) {
      alert('Please select a location on the map');
      return;
    }

    // Check for title conflict before saving
    if (selectedTitle && checkTitleConflict(selectedTitle)) {
      setTitleConflictMessage(`Address with title "${selectedTitle}" already exists. Please choose a different title or update the existing one.`);
      return;
    }

    setIsSaving(true);
    setTitleConflictMessage(null);
    try {
      // For "Other" option, use custom title in landmark if provided, otherwise just null title
      const finalLandmark = showOtherInput && customTitle 
        ? customTitle + (landmark ? `, ${landmark}` : '')
        : landmark || undefined;

      const addressData = {
        street_address: reverseGeocodeResult.streetLine || reverseGeocodeResult.formatted || '',
        city: reverseGeocodeResult.city || '',
        region: reverseGeocodeResult.region || '',
        formatted_address: reverseGeocodeResult.formatted || '',
        latitude: mapCoords.latitude,
        longitude: mapCoords.longitude,
        landmark: finalLandmark,
        title: selectedTitle || undefined,
      };

      const result = await addressService.createAddress(addressData);

      if (result.error) {
        // Check if it's a title conflict error
        if (result.error.message.includes('already exists')) {
          setTitleConflictMessage(result.error.message);
        } else {
          alert(result.error.message || 'Failed to save address');
        }
      } else {
        if (onSaveAddress) {
          onSaveAddress();
        }
        // Reset form
        setLandmark('');
        setSelectedTitle(null);
        setCustomTitle('');
        setShowOtherInput(false);
        setShowDetailsForm(false);
        setTitleConflictMessage(null);
        onClose();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-white font-medium text-sm flex-1 truncate">
                {reverseGeocodeResult?.formatted || searchQuery || 'Select location'}
              </span>
            </div>
            <button
              onClick={onClose}
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
                      setSearchQuery(e.target.value);
                      // If user types a new address, try to geocode it
                      if (e.target.value.trim().length > 5 && e.target.value !== DEFAULT_ADDRESS) {
                        try {
                          const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
                          const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(e.target.value)}&format=json&apiKey=${geoapifyKey}`;
                          const res = await fetch(url);
                          const json = await res.json();
                          if (json?.results?.length > 0) {
                            const result = json.results[0];
                            const newCoords = {
                              latitude: result.lat,
                              longitude: result.lon,
                            };
                            setMapCoords(newCoords);
                            await reverseGeocodeLocation(newCoords.latitude, newCoords.longitude);
                            if (mapRef.current?.animateCamera) {
                              mapRef.current.animateCamera({
                                center: newCoords,
                                zoom: 16,
                              }, { duration: 500 });
                            }
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
                          setSearchQuery('');
                        }}
                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        title="Clear"
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="hidden sm:inline text-xs">Locate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Map */}
            {mapCoords && (
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
                      await reverseGeocodeLocation(region.latitude, region.longitude);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Details Form (for saving address) */}
            {showDetailsForm && showSaveOption && (
              <div className="px-6 pb-4 space-y-4 border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900">Save Address Details</h3>
                
                {/* Title Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address Title (Optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleTitleSelection('home')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedTitle === 'home'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Home
                    </button>
                    <button
                      onClick={() => handleTitleSelection('office')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedTitle === 'office'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Office
                    </button>
                    <button
                      onClick={() => handleTitleSelection('other')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        showOtherInput
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Other
                    </button>
                  </div>
                  {titleConflictMessage && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">{titleConflictMessage}</p>
                    </div>
                  )}
                  {showOtherInput && (
                    <div className="mt-3">
                      <input
                        type="text"
                        className="w-full px-4 py-3 text-base text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter custom title (e.g., Work, Vacation Home)"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Landmark */}
                {!showOtherInput && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 text-base text-gray-900 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Near the park, Behind the mall"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="px-6 pb-6 space-y-2">
              {onUseLocation && (
                <button
                  onClick={handleUseLocation}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-6 rounded-xl font-semibold text-base transition-colors shadow-md hover:shadow-lg"
                >
                  Use This Location
                </button>
              )}
              {showSaveOption && user && (
                <button
                  onClick={showDetailsForm ? handleSaveAddress : () => setShowDetailsForm(true)}
                  disabled={isSaving || !mapCoords}
                  className="w-full bg-white text-blue-600 py-3.5 px-6 rounded-xl font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : showDetailsForm ? 'Save Address' : 'Save to Address Book'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

