import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WebMap from '../../../components/WebMap';
import { useDeliveryAreas, useSaveDeliveryAreas } from '../../../../../src/hooks/merchant/useDeliveryAreas';
import { useDeliveryLogic, useSaveDeliveryLogic } from '../../../../../src/hooks/merchant/useDeliveryLogic';
import type { DeliveryArea, DeliveryAreaPayload, LatLngLiteral } from '../../../../../src/types/delivery';
import type { DeliveryLogicPayload, DistanceTier } from '../../../../../src/services/merchant/deliveryLogicService';
import { polygonsOverlap } from '../../../../../src/utils/polygons';
import ShopIcon from '../../../../../src/icons/ShopIcon';

type LocalArea = {
  id?: string;
  label: string;
  coordinates: LatLngLiteral[];
};

export default function ManageDeliveryAreasScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const shop = (location.state as any)?.shop;

  const { data: savedAreas = [], isLoading } = useDeliveryAreas(shop?.id || '');
  const saveMutation = useSaveDeliveryAreas(shop?.id || '');
  const { data: deliveryLogic, isLoading: isLoadingLogic } = useDeliveryLogic(shop?.id || '');
  const saveLogicMutation = useSaveDeliveryLogic(shop?.id || '');

  const [areas, setAreas] = useState<LocalArea[]>([]);
  const [editingVertices, setEditingVertices] = useState<LatLngLiteral[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAreaLabel, setCurrentAreaLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; address: string; coords: { latitude: number; longitude: number } }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showAreasList, setShowAreasList] = useState(true);
  const [showDeliveryLogic, setShowDeliveryLogic] = useState(false);
  const [validationResults, setValidationResults] = useState<{ errors: string[]; warnings: string[]; isValid: boolean } | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Delivery logic form state
  const [logicForm, setLogicForm] = useState<DeliveryLogicPayload>({});

  // Use ref to track editing state for click handler (to avoid stale closure)
  const isEditingRef = useRef(false);
  const mapRef = useRef<any>(null);
  
  // Sync ref with state
  useEffect(() => {
    isEditingRef.current = isEditing;
    console.log('isEditing state changed to:', isEditing);
  }, [isEditing]);

  const shopLat = shop ? parseFloat(shop.latitude) || 31.451483 : 31.451483;
  const shopLng = shop ? parseFloat(shop.longitude) || 74.435203 : 74.435203;

  // Color palette for different delivery zones
  const zoneColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
  ];

  // Get color for a zone by index
  const getZoneColor = (index: number) => {
    return zoneColors[index % zoneColors.length];
  };

  useEffect(() => {
    if (savedAreas.length > 0) {
      setAreas(savedAreas.map((area) => ({
        id: area.id,
        label: area.label || `Zone ${areas.length + 1}`,
        coordinates: area.coordinates,
      })));
    }
  }, [savedAreas]);

  // Initialize delivery logic form when data loads
  useEffect(() => {
    if (deliveryLogic) {
      setLogicForm({
        minimumOrderValue: deliveryLogic.minimumOrderValue,
        smallOrderSurcharge: deliveryLogic.smallOrderSurcharge,
        leastOrderValue: deliveryLogic.leastOrderValue,
        distanceMode: deliveryLogic.distanceMode,
        maxDeliveryFee: deliveryLogic.maxDeliveryFee,
        distanceTiers: deliveryLogic.distanceTiers,
        beyondTierFeePerUnit: deliveryLogic.beyondTierFeePerUnit,
        beyondTierDistanceUnit: deliveryLogic.beyondTierDistanceUnit,
        freeDeliveryThreshold: deliveryLogic.freeDeliveryThreshold,
        freeDeliveryRadius: deliveryLogic.freeDeliveryRadius,
      });
    }
  }, [deliveryLogic]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSearchResults && !target.closest('.search-container')) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchResults]);

  const handleMapClick = (lat: number, lng: number) => {
    // Use ref to get the latest editing state
    const currentlyEditing = isEditingRef.current;
    console.log('Map clicked at:', lat, lng, 'isEditing (from ref):', currentlyEditing, 'isEditing (from state):', isEditing, 'current vertices:', editingVertices.length);
    
    if (!currentlyEditing) {
      // If not editing, show a helpful message
      console.log('Not in editing mode, ignoring click');
      // Show a temporary message to guide the user
      const message = document.createElement('div');
      message.textContent = 'Click "Add Delivery Area" button first to start adding points';
      message.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 16px 24px; border-radius: 8px; z-index: 10000; pointer-events: none; font-size: 14px;';
      document.body.appendChild(message);
      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
      }, 2000);
      return;
    }
    
    // Add point since we're in editing mode
    console.log('Adding point:', { latitude: lat, longitude: lng });
    setEditingVertices((prev) => {
      const newVertices = [...prev, { latitude: lat, longitude: lng }];
      console.log('New vertices count:', newVertices.length);
      return newVertices;
    });
  };

  const handleStartNewArea = () => {
    console.log('Starting new area - entering editing mode');
    console.log('Current isEditing state:', isEditing);
    setEditingVertices([]);
    setIsEditing(true);
    setCurrentAreaLabel(`Zone ${areas.length + 1}`);
    // Use setTimeout to check state after update
    setTimeout(() => {
      console.log('After state update - isEditing should be true now');
    }, 0);
  };

  // Calculate polygon area in square kilometers (approximate)
  const calculateArea = (coordinates: LatLngLiteral[]): number => {
    if (coordinates.length < 3) return 0;
    
    // Using Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length;
      area += coordinates[i].longitude * coordinates[j].latitude;
      area -= coordinates[j].longitude * coordinates[i].latitude;
    }
    area = Math.abs(area) / 2;
    
    // Convert to square kilometers (approximate, using average latitude)
    const avgLat = coordinates.reduce((sum, p) => sum + p.latitude, 0) / coordinates.length;
    const latRad = (avgLat * Math.PI) / 180;
    const latMeters = 111320; // meters per degree latitude
    const lonMeters = 111320 * Math.cos(latRad); // meters per degree longitude
    const areaKm2 = (area * latMeters * lonMeters) / 1000000;
    
    return areaKm2;
  };

  // Check for overlaps before adding area
  const checkOverlaps = (newCoordinates: LatLngLiteral[], excludeIndex?: number): { hasOverlap: boolean; overlappingAreas: string[] } => {
    const existingAreas = areas
      .map((area, idx) => ({ area, idx }))
      .filter(({ idx }) => excludeIndex === undefined || idx !== excludeIndex);
    
    const overlappingAreas: string[] = [];
    
    for (const { area, idx } of existingAreas) {
      if (polygonsOverlap(newCoordinates, area.coordinates)) {
        overlappingAreas.push(area.label || `Zone ${idx + 1}`);
      }
    }
    
    return {
      hasOverlap: overlappingAreas.length > 0,
      overlappingAreas,
    };
  };

  const handleFinishArea = () => {
    if (editingVertices.length < 3) {
      alert('Please add at least 3 points to create a delivery area');
      return;
    }

    // Check for overlaps
    const overlapCheck = checkOverlaps(editingVertices);
    if (overlapCheck.hasOverlap) {
      const message = `This area overlaps with: ${overlapCheck.overlappingAreas.join(', ')}\n\nDelivery areas cannot overlap. Please adjust the area boundaries.`;
      if (!confirm(message + '\n\nDo you want to add it anyway? (It will be rejected by the server)')) {
        return;
      }
    }

    // Validate polygon is closed
    const first = editingVertices[0];
    const last = editingVertices[editingVertices.length - 1];
    const isClosed = first.latitude === last.latitude && first.longitude === last.longitude;
    
    if (!isClosed && editingVertices.length >= 3) {
      // Auto-close the polygon
      const closedVertices = [...editingVertices, { ...first }];
      setAreas([...areas, { label: currentAreaLabel, coordinates: closedVertices }]);
    } else {
    setAreas([...areas, { label: currentAreaLabel, coordinates: editingVertices }]);
    }
    
    setEditingVertices([]);
    setIsEditing(false);
    setCurrentAreaLabel('');
  };

  const handleRemoveArea = (index: number) => {
    if (confirm('Are you sure you want to remove this delivery area?')) {
      setAreas(areas.filter((_, i) => i !== index));
    }
  };

  const fetchGeoapifyAutocomplete = async (q: string) => {
    const geoapifyKey = (import.meta as any).env?.VITE_GEOAPIFY_API_KEY || '3e078bb3a2bc4892b9e1757e92860438';
    const bias = shop ? `&bias=proximity:${shopLng},${shopLat}` : '';
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=10&format=json${bias}&apiKey=${geoapifyKey}`;
    
    try {
      const res = await fetch(url, { 
        headers: { 'User-Agent': 'AroundYouApp/1.0 (support@aroundyou.app)' } as any 
      });
      const json = await res.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      
      return results.map((r: any, idx: number) => {
        const name = r?.name || r?.address_line1 || r?.street || r?.formatted?.split(',')?.[0] || q;
        const address = r?.formatted || [r?.address_line1, r?.address_line2].filter(Boolean).join(', ');
        return {
          id: r?.place_id ? String(r.place_id) : `${r?.lat}-${r?.lon}-${idx}`,
          name,
          address: address || name,
          coords: { latitude: Number(r?.lat), longitude: Number(r?.lon) },
        };
      });
    } catch (error) {
      console.error('Error fetching autocomplete:', error);
      return [];
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setShowSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const suggestions = await fetchGeoapifyAutocomplete(query);
        setSearchResults(suggestions);
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSearchResult = (result: { coords: { latitude: number; longitude: number }; address: string }) => {
    setSearchQuery(result.address);
    setShowSearchResults(false);
    setSearchResults([]);
    
    // Move map to selected location
    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        },
        zoom: 15,
      }, { duration: 500 });
    }
  };

  const handleValidate = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate delivery areas
    if (areas.length === 0) {
      warnings.push('No delivery areas defined. Customers won\'t be able to place orders.');
    } else {
      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        
        // Check minimum points
        if (area.coordinates.length < 3) {
          errors.push(`${area.label || `Zone ${i + 1}`}: Needs at least 3 points to form a polygon`);
        }
        
        // Check for overlaps with other areas
        const overlapCheck = checkOverlaps(area.coordinates, i);
        if (overlapCheck.hasOverlap) {
          errors.push(`${area.label || `Zone ${i + 1}`}: Overlaps with ${overlapCheck.overlappingAreas.join(', ')}`);
        }
        
        // Check area size
        const areaSize = calculateArea(area.coordinates);
        if (areaSize < 0.01) {
          warnings.push(`${area.label || `Zone ${i + 1}`}: Very small area (${areaSize.toFixed(4)} km²) - may be too restrictive`);
        }
      }
    }

    // Validate delivery logic
    if (deliveryLogic || Object.keys(logicForm).length > 0) {
      const logic = { ...deliveryLogic, ...logicForm };
      
      if (logic.minimumOrderValue !== undefined && logic.minimumOrderValue <= 0) {
        errors.push('Minimum Order Value must be greater than 0');
      }
      
      if (logic.leastOrderValue !== undefined && logic.minimumOrderValue !== undefined) {
        if (logic.leastOrderValue > logic.minimumOrderValue) {
          errors.push('Least Order Value cannot be greater than Minimum Order Value');
        }
      }
      
      if (logic.smallOrderSurcharge !== undefined && logic.smallOrderSurcharge < 0) {
        errors.push('Small Order Surcharge cannot be negative');
      }
      
      if (logic.maxDeliveryFee !== undefined && logic.maxDeliveryFee <= 0) {
        errors.push('Max Delivery Fee must be greater than 0');
      }
      
      if (logic.distanceTiers && logic.distanceTiers.length > 0) {
        let prevMaxDistance = 0;
        for (let i = 0; i < logic.distanceTiers.length; i++) {
          const tier = logic.distanceTiers[i];
          if (tier.max_distance <= prevMaxDistance) {
            warnings.push(`Distance Tier ${i + 1}: Max distance (${tier.max_distance}m) should be greater than previous tier (${prevMaxDistance}m)`);
          }
          if (tier.fee < 0) {
            errors.push(`Distance Tier ${i + 1}: Fee cannot be negative`);
          }
          prevMaxDistance = tier.max_distance;
        }
      }
      
      if (logic.freeDeliveryThreshold !== undefined && logic.freeDeliveryThreshold < 0) {
        warnings.push('Free Delivery Threshold is set to 0 or negative - free delivery will not apply');
      }
    } else {
      warnings.push('Delivery logic not configured - using default values');
    }

    const isValid = errors.length === 0;
    setValidationResults({ errors, warnings, isValid });
    
    // Show results
    if (isValid && warnings.length === 0) {
      alert('✅ All checks passed! Your delivery areas and logic are valid.');
    } else {
      let message = isValid ? '✅ Validation passed with warnings:\n\n' : '❌ Validation found errors:\n\n';
      
      if (errors.length > 0) {
        message += 'Errors:\n' + errors.map(e => `  • ${e}`).join('\n') + '\n\n';
      }
      
      if (warnings.length > 0) {
        message += 'Warnings:\n' + warnings.map(w => `  • ${w}`).join('\n');
      }
      
      alert(message);
    }
  };

  const handleSave = async () => {
    if (!shop) return;
    
    // Validate all areas before saving
    const validationErrors: string[] = [];
    
    for (let i = 0; i < areas.length; i++) {
      const area = areas[i];
      
      // Check minimum points
      if (area.coordinates.length < 3) {
        validationErrors.push(`${area.label || `Zone ${i + 1}`}: Needs at least 3 points`);
        continue;
      }
      
      // Check for overlaps with other areas
      const overlapCheck = checkOverlaps(area.coordinates, i);
      if (overlapCheck.hasOverlap) {
        validationErrors.push(`${area.label || `Zone ${i + 1}`}: Overlaps with ${overlapCheck.overlappingAreas.join(', ')}`);
      }
    }
    
    if (validationErrors.length > 0) {
      alert('Validation errors:\n\n' + validationErrors.join('\n') + '\n\nPlease fix these issues before saving.');
      return;
    }
    
    try {
      const areasToSave: DeliveryAreaPayload[] = areas.map((area, index) => ({
        label: area.label || `Zone ${index + 1}`,
        coordinates: area.coordinates,
      }));
      await saveMutation.mutateAsync(areasToSave);
      navigate(-1);
    } catch (error: any) {
      // Parse database errors for better user feedback
      let errorMessage = 'Failed to save delivery areas';
      
      if (error?.message) {
        if (error.message.includes('overlap')) {
          errorMessage = 'Delivery areas cannot overlap. Please adjust the boundaries.';
        } else if (error.message.includes('invalid') || error.message.includes('geometry')) {
          errorMessage = 'Invalid polygon geometry. Please ensure all areas are properly closed polygons.';
        } else if (error.message.includes('required')) {
          errorMessage = 'All delivery areas must have valid coordinates.';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
      console.error('Save error:', error);
    }
  };

  if (!shop) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Shop not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white relative" style={{ height: '100vh' }}>
      <div
        className="absolute top-0 left-0 right-0 z-30 px-4 py-3"
        style={{
          background: 'linear-gradient(to right, #1e3a8a, #3b82f6)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(-1)}
            className="text-white text-2xl"
          >
            ←
          </button>
          <h1 className="text-white text-xl font-bold flex-1 text-center">Delivery Areas</h1>
          <div className="w-8" />
        </div>

        {/* Search Bar */}
        <div className="relative search-container">
          <div className="flex items-center bg-white rounded-xl px-4 py-2.5 shadow-md">
            <span className="text-gray-400 text-xl mr-2">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              placeholder="Search for an address or location..."
              className="flex-1 text-gray-800 text-sm bg-transparent border-none outline-none placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="text-gray-400 hover:text-gray-600 ml-2 text-lg"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && (searchResults.length > 0 || isSearching) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-64 overflow-y-auto z-50">
              {isSearching ? (
                <div className="px-4 py-3 text-center text-gray-500 text-sm">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-center text-gray-500 text-sm">No results found</div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectSearchResult(result)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-gray-900 text-sm">{result.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{result.address}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-32 left-0 right-0 bottom-0" style={{ zIndex: 10, pointerEvents: 'auto' }}>
        <WebMap
          mapRef={mapRef}
          initialRegion={{
            latitude: shopLat,
            longitude: shopLng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onMapClick={handleMapClick}
          polygons={[
            // Existing saved areas with different colors
            ...areas.map((area, index) => ({
            coordinates: area.coordinates,
              color: getZoneColor(index),
            })),
            // Currently editing area (always green)
            ...(editingVertices.length > 0 ? [{
              coordinates: editingVertices.length >= 3 
                ? [...editingVertices, editingVertices[0]] // Close the polygon if 3+ points
                : editingVertices, // Show open polygon if less than 3 points
              color: '#10B981', // Green for editing
            }] : [])
          ]}
          markers={[
            {
            latitude: shopLat,
            longitude: shopLng,
              icon: <span className="text-2xl">🏪</span>,
            },
            // Add markers for each editing vertex
            ...editingVertices.map((vertex, index) => ({
              latitude: vertex.latitude,
              longitude: vertex.longitude,
              icon: <span className="text-xl">📍</span>,
            })),
          ]}
        />
      </div>

      {/* Side Panel for Controls */}
      <div className="absolute top-32 right-4 bottom-4 w-80 max-w-[calc(100%-2rem)] z-20 flex flex-col gap-3 pointer-events-none">
        {isEditing ? (
          <div className="bg-white rounded-xl p-4 shadow-xl pointer-events-auto max-h-full overflow-y-auto">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">Zone Name</span>
                <span className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded">{editingVertices.length} point{editingVertices.length !== 1 ? 's' : ''}</span>
              </div>
            <input
              type="text"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Zone 1, Downtown Area"
              value={currentAreaLabel}
              onChange={(e) => setCurrentAreaLabel(e.target.value)}
            />
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleFinishArea}
                disabled={editingVertices.length < 3}
                className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Finish ({editingVertices.length})
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingVertices([]);
                  setCurrentAreaLabel('');
                }}
                className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all text-sm"
              >
                Cancel
              </button>
            </div>
            {editingVertices.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Remove last point?')) {
                    setEditingVertices(editingVertices.slice(0, -1));
                  }
                }}
                className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-all text-sm mb-2"
              >
                Remove Last Point
              </button>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium mb-1">📌 Click on the map to add points</p>
              <p className="text-xs text-blue-600">
                {editingVertices.length < 3 
                  ? `Add ${3 - editingVertices.length} more point${3 - editingVertices.length !== 1 ? 's' : ''} to create the area`
                  : 'You can add more points or finish the area'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pointer-events-auto">
            <button
              onClick={handleStartNewArea}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:bg-blue-700 transition-all"
            >
              Add Delivery Area
            </button>
            {areas.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saveMutation.isLoading}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {saveMutation.isLoading ? 'Saving...' : 'Save Areas'}
              </button>
            )}
          </div>
        )}

        {/* Delivery Logic Settings - Below Delivery Areas */}
        <div className="bg-white rounded-xl shadow-xl pointer-events-auto mt-3">
          <button
            onClick={() => setShowDeliveryLogic(!showDeliveryLogic)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-semibold text-gray-700">Delivery Logic & Fees</div>
            <span className="text-gray-400">{showDeliveryLogic ? '▼' : '▶'}</span>
          </button>
          {showDeliveryLogic && (
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {isLoadingLogic ? (
                <div className="text-center text-gray-500 text-sm py-4">Loading...</div>
              ) : (
                <>
                  {/* Order Value Layer */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Order Value Settings</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Minimum Order Value (PKR) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={logicForm.minimumOrderValue ?? deliveryLogic?.minimumOrderValue ?? 200}
                          onChange={(e) => setLogicForm({ ...logicForm, minimumOrderValue: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="200.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">Orders below this get a surcharge. Recommended: 200-500 PKR.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Small Order Surcharge (PKR) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={logicForm.smallOrderSurcharge ?? deliveryLogic?.smallOrderSurcharge ?? 40}
                          onChange={(e) => setLogicForm({ ...logicForm, smallOrderSurcharge: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="40.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">Additional fee for orders below minimum. Typical: 30-50 PKR.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Least Order Value (PKR) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={logicForm.leastOrderValue ?? deliveryLogic?.leastOrderValue ?? 100}
                          onChange={(e) => setLogicForm({ ...logicForm, leastOrderValue: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="100.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">*Critical:* Orders below this are rejected. Must be ≤ Minimum Order Value.</p>
                      </div>
                    </div>
                  </div>

                  {/* Distance Layer */}
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Distance-Based Fees</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Max Delivery Fee (PKR) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={logicForm.maxDeliveryFee ?? deliveryLogic?.maxDeliveryFee ?? 130}
                          onChange={(e) => setLogicForm({ ...logicForm, maxDeliveryFee: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="130.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum cap for delivery fees. Typical: 100-200 PKR.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Distance Mode
                        </label>
                        <select
                          value={logicForm.distanceMode ?? deliveryLogic?.distanceMode ?? 'auto'}
                          onChange={(e) => setLogicForm({ ...logicForm, distanceMode: e.target.value as 'auto' | 'custom' })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="auto">Auto (Default Algorithm)</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Distance Tiers */}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Distance Tiers (meters → PKR) <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Define distance ranges and fees. Tiers must be in ascending order.</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? []).map((tier, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={tier.max_distance}
                              onChange={(e) => {
                                const newTiers = [...(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? [])];
                                newTiers[index] = { ...tier, max_distance: parseInt(e.target.value) || 0 };
                                setLogicForm({ ...logicForm, distanceTiers: newTiers });
                              }}
                              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                              placeholder="Distance (m)"
                            />
                            <span className="text-xs text-gray-500">→</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tier.fee}
                              onChange={(e) => {
                                const newTiers = [...(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? [])];
                                newTiers[index] = { ...tier, fee: parseFloat(e.target.value) || 0 };
                                setLogicForm({ ...logicForm, distanceTiers: newTiers });
                              }}
                              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                              placeholder="Fee (PKR)"
                            />
                            <button
                              onClick={() => {
                                const newTiers = (logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? []).filter((_, i) => i !== index);
                                setLogicForm({ ...logicForm, distanceTiers: newTiers });
                              }}
                              className="text-red-500 hover:text-red-700 text-xs px-2"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newTiers = [...(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? []), { max_distance: 0, fee: 0 }];
                            setLogicForm({ ...logicForm, distanceTiers: newTiers });
                          }}
                          className="w-full text-xs text-blue-600 hover:text-blue-700 py-1.5 border border-blue-200 rounded hover:bg-blue-50"
                        >
                          + Add Tier
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Beyond Tier Fee/Unit (PKR)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={logicForm.beyondTierFeePerUnit ?? deliveryLogic?.beyondTierFeePerUnit ?? 10}
                          onChange={(e) => setLogicForm({ ...logicForm, beyondTierFeePerUnit: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="10.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Distance Unit (meters)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={logicForm.beyondTierDistanceUnit ?? deliveryLogic?.beyondTierDistanceUnit ?? 250}
                          onChange={(e) => setLogicForm({ ...logicForm, beyondTierDistanceUnit: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="250"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Free Delivery */}
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Free Delivery</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Order Threshold (PKR)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={logicForm.freeDeliveryThreshold ?? deliveryLogic?.freeDeliveryThreshold ?? 800}
                          onChange={(e) => setLogicForm({ ...logicForm, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="800.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">Minimum order value for free delivery.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Max Radius (meters)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={logicForm.freeDeliveryRadius ?? deliveryLogic?.freeDeliveryRadius ?? 1000}
                          onChange={(e) => setLogicForm({ ...logicForm, freeDeliveryRadius: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="1000"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum distance for free delivery.</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">*Both conditions must be met: Order value ≥ Threshold AND Distance ≤ Radius.</p>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={async () => {
                      try {
                        await saveLogicMutation.mutateAsync(logicForm);
                        alert('Delivery logic saved successfully!');
                      } catch (error: any) {
                        alert(error.message || 'Failed to save delivery logic');
                      }
                    }}
                    disabled={saveLogicMutation.isLoading}
                    className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-4"
                  >
                    {saveLogicMutation.isLoading ? 'Saving...' : 'Save Delivery Logic'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Areas List - Collapsible */}
        {areas.length > 0 && (
          <div className="bg-white rounded-xl shadow-xl pointer-events-auto flex-1 flex flex-col min-h-0">
            <button
              onClick={() => setShowAreasList(!showAreasList)}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm font-semibold text-gray-700">Delivery Areas ({areas.length})</div>
              <span className="text-gray-400">{showAreasList ? '▼' : '▶'}</span>
            </button>
            {showAreasList && (
              <div className="flex-1 overflow-y-auto p-2">
                {/* Validation Results */}
                {validationResults && (
                  <div className={`mb-3 p-3 rounded-lg text-xs ${
                    validationResults.isValid 
                      ? 'bg-green-50 border border-green-200 text-green-800' 
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    <div className="font-semibold mb-1">
                      {validationResults.isValid ? '✅ Validation Status' : '❌ Validation Errors'}
                    </div>
                    {validationResults.errors.length > 0 && (
                      <div className="mb-2">
                        <div className="font-medium">Errors:</div>
                        <ul className="list-disc list-inside ml-2">
                          {validationResults.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {validationResults.warnings.length > 0 && (
                <div>
                        <div className="font-medium">Warnings:</div>
                        <ul className="list-disc list-inside ml-2">
                          {validationResults.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {areas.map((area, index) => {
                  const areaSize = calculateArea(area.coordinates);
                  const overlapCheck = checkOverlaps(area.coordinates, index);
                  const hasErrors = validationResults?.errors.some(e => e.includes(area.label || `Zone ${index + 1}`));
                  
                  return (
                    <div key={index} className={`py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                      hasErrors ? 'bg-red-50' : ''
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Color indicator matching the polygon color */}
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300" 
                            style={{ backgroundColor: getZoneColor(index) }}
                            title={`Zone color: ${getZoneColor(index)}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">{area.label}</div>
                            <div className="text-xs text-gray-600">
                              {area.coordinates.length} points
                              {areaSize > 0 && ` • ${areaSize.toFixed(2)} km²`}
                            </div>
                          </div>
                </div>
                <button
                  onClick={() => handleRemoveArea(index)}
                          className="text-red-600 hover:text-red-700 px-2 py-1 text-sm font-medium"
                >
                  Remove
                </button>
                      </div>
                      {overlapCheck.hasOverlap && (
                        <div className="mt-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          ⚠️ Overlaps with: {overlapCheck.overlappingAreas.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
                {areas.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 px-2">
                    Total Coverage: {areas.reduce((sum, area) => sum + calculateArea(area.coordinates), 0).toFixed(2)} km²
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


