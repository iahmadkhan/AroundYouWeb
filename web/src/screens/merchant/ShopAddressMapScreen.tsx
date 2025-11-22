import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WebMap from '../../components/WebMap';
import { useLocationStore } from '../../../../src/stores/locationStore';
import { useGeoapifyAutocomplete, SearchResult } from '../../../../src/hooks/useLocationQueries';

const PAKISTAN_CENTER = {
  latitude: 31.451483,
  longitude: 74.435203,
};

export default function ShopAddressMapScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo || '/createshop';
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);

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

  const [mapRegion, setMapRegion] = useState({
    latitude: confirmedLocation?.coords?.latitude || PAKISTAN_CENTER.latitude,
    longitude: confirmedLocation?.coords?.longitude || PAKISTAN_CENTER.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const lastRegionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheetMode, setSheetMode] = useState<'search' | 'confirm'>('search');

  // Debounce search query to avoid too many API calls
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

  useEffect(() => {
    if (confirmedLocation?.coords) {
      const coords = {
        latitude: confirmedLocation.coords.latitude,
        longitude: confirmedLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(coords);
      lastRegionRef.current = confirmedLocation.coords;
      setReverseGeocode({
        formatted: confirmedLocation.address || confirmedLocation.streetLine || 'Selected location',
        city: confirmedLocation.city,
        region: confirmedLocation.region,
        streetLine: confirmedLocation.streetLine,
      });
      setSheetMode('confirm');
    }
  }, [confirmedLocation]);

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
    }, 800);
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

  const handleConfirm = () => {
    if (!lastRegionRef.current || !reverseGeocode) {
      alert('Please select a location on the map');
      return;
    }
    navigate(returnTo, {
      state: {
        address: {
          formatted: reverseGeocode.formatted,
          address: reverseGeocode.formatted,
          streetLine: reverseGeocode.streetLine,
          city: reverseGeocode.city,
          region: reverseGeocode.region,
          latitude: lastRegionRef.current.latitude,
          longitude: lastRegionRef.current.longitude,
        },
      },
    });
  };

  const sheetHeight = sheetMode === 'search' ? '50%' : '30%';

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

      {/* Bottom Sheet - Only for confirm mode */}
      {sheetMode === 'confirm' && (
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

            {reverseGeocode && (
              <div className="flex-1 flex flex-col px-4">
                <div className="mb-4">
                  <div className="text-lg font-semibold text-gray-900 mb-1">
                    {reverseGeocode.streetLine || reverseGeocode.city || 'Selected location'}
                  </div>
                  <div className="text-sm text-gray-600">{reverseGeocode.formatted}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    onClick={handleConfirm}
                  >
                    Confirm This Location
                  </button>
                  <button
                    className="bg-white text-blue-600 py-3 px-6 rounded-xl font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
                    onClick={() => setSheetMode('search')}
                  >
                    Search Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
