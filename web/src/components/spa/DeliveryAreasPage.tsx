import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMerchantShops, type MerchantShop } from '../../../../src/services/merchant/shopService';
import { useAuth } from '../../../../src/context/AuthContext';
import { useDeliveryAreas, useSaveDeliveryAreas } from '../../../../src/hooks/merchant/useDeliveryAreas';
import type { DeliveryArea, DeliveryAreaPayload, LatLngLiteral } from '../../../../src/types/delivery';
import { polygonsOverlap } from '../../../../src/utils/polygons';
import WebMap from '../WebMap';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

interface DeliveryAreasPageProps {
  shopId?: string;
}

type LocalArea = {
  id?: string;
  label: string;
  coordinates: LatLngLiteral[];
};

export default function DeliveryAreasPage({ shopId: propShopId }: DeliveryAreasPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>(propShopId || '');
  const [selectedShop, setSelectedShop] = useState<MerchantShop | null>(null);

  const { data: savedAreas = [], isLoading } = useDeliveryAreas(selectedShopId);
  const saveMutation = useSaveDeliveryAreas(selectedShopId);

  const [areas, setAreas] = useState<LocalArea[]>([]);
  const [editingVertices, setEditingVertices] = useState<LatLngLiteral[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAreaLabel, setCurrentAreaLabel] = useState('');
  const [editingAreaIndex, setEditingAreaIndex] = useState<number | null>(null);
  const mapRef = useRef<any>(null);
  const isEditingRef = useRef(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingAreaIndex, setDeletingAreaIndex] = useState<number | null>(null);
  const [lastClickedCoords, setLastClickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Sync ref with state
  useEffect(() => {
    isEditingRef.current = isEditing;
    console.log('isEditing state changed to:', isEditing);
  }, [isEditing]);

  // Update selectedShopId when propShopId changes
  useEffect(() => {
    if (propShopId && propShopId !== selectedShopId) {
      setSelectedShopId(propShopId);
    }
  }, [propShopId]);

  useEffect(() => {
    if (user) {
      loadShops();
    }
  }, [user]);

  useEffect(() => {
    if (selectedShopId && shops.length > 0) {
      const shop = shops.find(s => s.id === selectedShopId);
      setSelectedShop(shop || null);
    }
  }, [selectedShopId, shops]);

  // Calculate shop coordinates - use useMemo to ensure it updates when shop changes
  const shopLat = useMemo(() => {
    return selectedShop ? (typeof selectedShop.latitude === 'string' ? parseFloat(selectedShop.latitude) : selectedShop.latitude) || 31.451483 : 31.451483;
  }, [selectedShop]);
  
  const shopLng = useMemo(() => {
    return selectedShop ? (typeof selectedShop.longitude === 'string' ? parseFloat(selectedShop.longitude) : selectedShop.longitude) || 74.435203 : 74.435203;
  }, [selectedShop]);

  // Update map when shop changes - this will trigger when selectedShopId or selectedShop changes
  useEffect(() => {
    if (selectedShop && shopLat && shopLng && !isNaN(shopLat) && !isNaN(shopLng)) {
      // Wait for map to be ready, then update
      const updateMap = () => {
        if (mapRef.current?.animateCamera) {
          try {
            mapRef.current.animateCamera(
              { center: { latitude: shopLat, longitude: shopLng }, zoom: 16 },
              { duration: 500 }
            );
          } catch (error) {
            console.warn('Error animating camera:', error);
          }
        }
      };
      
      // Try multiple times with increasing delays to ensure map is ready
      const timeouts: ReturnType<typeof setTimeout>[] = [];
      timeouts.push(setTimeout(updateMap, 100));
      timeouts.push(setTimeout(updateMap, 300));
      timeouts.push(setTimeout(updateMap, 600));
      timeouts.push(setTimeout(updateMap, 1200));
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [selectedShop, selectedShopId, shopLat, shopLng]);

  // Use ref to track previous savedAreas to prevent infinite loops
  const prevSavedAreasRef = useRef<string>('');
  
  useEffect(() => {
    // Create a stable string representation of savedAreas to compare
    const savedAreasKey = JSON.stringify(savedAreas.map(area => ({
      id: area.id,
      label: area.label,
      coordinates: area.coordinates,
    })));
    
    // Only update if savedAreas actually changed
    if (prevSavedAreasRef.current !== savedAreasKey) {
      prevSavedAreasRef.current = savedAreasKey;
      
    if (savedAreas.length > 0) {
      setAreas(savedAreas.map((area, index) => ({
        id: area.id,
        label: area.label || `Zone ${index + 1}`,
        coordinates: area.coordinates,
      })));
    } else {
      setAreas([]);
      }
    }
  }, [savedAreas]);

  const loadShops = async () => {
    if (!user) return;
    try {
      const { shops: fetchedShops, error } = await getMerchantShops(user.id);
      if (!error && fetchedShops) {
        setShops(fetchedShops);
        if (fetchedShops.length > 0 && !selectedShopId) {
          setSelectedShopId(fetchedShops[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading shops:', error);
    }
  };

  const handleStartDrawing = () => {
    console.log('Starting drawing mode');
    setIsEditing(true);
    isEditingRef.current = true;
    setEditingVertices([]);
    setCurrentAreaLabel('');
    setEditingAreaIndex(null);
  };

  const handleMapClick = (lat: number, lng: number) => {
    console.log('Map clicked at:', lat, lng, 'isEditing (state):', isEditing, 'isEditing (ref):', isEditingRef.current);
    
    // Always show coordinates when clicking, even if not in edit mode
    setLastClickedCoords({ lat, lng });
    // Clear any existing timeout
    const timeoutId = setTimeout(() => {
      setLastClickedCoords(null);
    }, 3000);
    
    // Store timeout ID to clear it if needed
    if ((window as any).coordDisplayTimeout) {
      clearTimeout((window as any).coordDisplayTimeout);
    }
    (window as any).coordDisplayTimeout = timeoutId;
    
    if (!isEditingRef.current) {
      console.log('Map clicked but not in editing mode. Click "Draw New Area" first.');
      return;
    }
    console.log('Adding point:', lat, lng);
    const newVertex = { latitude: lat, longitude: lng };
    setEditingVertices(prev => {
      const updated = [...prev, newVertex];
      console.log('Updated vertices:', updated.length);
      return updated;
    });
  };

  const handleFinishDrawing = () => {
    console.log('Finish button clicked', { 
      verticesCount: editingVertices.length, 
      label: currentAreaLabel,
      editingAreaIndex 
    });

    if (editingVertices.length < 3) {
      alert('Please draw at least 3 points to create a delivery area');
      return;
    }
    if (!currentAreaLabel.trim()) {
      alert('Please enter a label for this delivery area');
      return;
    }

    const newArea: LocalArea = {
      label: currentAreaLabel.trim(),
      coordinates: [...editingVertices], // Create a copy to avoid reference issues
    };

    console.log('Creating new area:', newArea);

    if (editingAreaIndex !== null) {
      // Update existing area
      const updatedAreas = [...areas];
      updatedAreas[editingAreaIndex] = { ...updatedAreas[editingAreaIndex], ...newArea };
      setAreas(updatedAreas);
      console.log('Updated area at index', editingAreaIndex);
    } else {
      // Add new area
      setAreas(prev => {
        const updated = [...prev, newArea];
        console.log('Added new area, total areas:', updated.length);
        return updated;
      });
    }

    setIsEditing(false);
    isEditingRef.current = false;
    setEditingVertices([]);
    setCurrentAreaLabel('');
    setEditingAreaIndex(null);
    
    console.log('Finished drawing, editing mode disabled');
  };

  const handleCancelDrawing = () => {
    setIsEditing(false);
    isEditingRef.current = false;
    setEditingVertices([]);
    setCurrentAreaLabel('');
    setEditingAreaIndex(null);
  };

  const handleEditArea = (index: number) => {
    const area = areas[index];
    setEditingAreaIndex(index);
    setEditingVertices(area.coordinates);
    setCurrentAreaLabel(area.label);
    setIsEditing(true);
    isEditingRef.current = true;
  };

  const handleDeleteArea = (index: number) => {
    setDeletingAreaIndex(index);
  };

  const confirmDeleteArea = () => {
    if (deletingAreaIndex !== null) {
      const updatedAreas = areas.filter((_, i) => i !== deletingAreaIndex);
      setAreas(updatedAreas);
      setDeletingAreaIndex(null);
    }
  };

  const cancelDeleteArea = () => {
    setDeletingAreaIndex(null);
  };

  const handleSaveAreas = async () => {
    if (!selectedShopId) {
      setSaveError('Please select a shop first');
      setTimeout(() => setSaveError(null), 3000);
      return;
    }

    if (areas.length === 0) {
      setSaveError('No areas to save. Please create at least one delivery area.');
      setTimeout(() => setSaveError(null), 3000);
      return;
    }

    setSaveError(null);
    setSaveSuccess(false);
    console.log('Saving areas:', { shopId: selectedShopId, areasCount: areas.length });

    // Check for overlapping areas
    for (let i = 0; i < areas.length; i++) {
      for (let j = i + 1; j < areas.length; j++) {
        const area1 = areas[i];
        const area2 = areas[j];
        
        // Ensure coordinates are valid before checking overlap
        if (!area1.coordinates || area1.coordinates.length < 3 || 
            !area2.coordinates || area2.coordinates.length < 3) {
          continue; // Skip invalid polygons
        }

        // Close polygons for overlap check
        let coords1 = [...area1.coordinates];
        let coords2 = [...area2.coordinates];
        
        const first1 = coords1[0];
        const last1 = coords1[coords1.length - 1];
        if (first1.latitude !== last1.latitude || first1.longitude !== last1.longitude) {
          coords1.push({ latitude: first1.latitude, longitude: first1.longitude });
        }
        
        const first2 = coords2[0];
        const last2 = coords2[coords2.length - 1];
        if (first2.latitude !== last2.latitude || first2.longitude !== last2.longitude) {
          coords2.push({ latitude: first2.latitude, longitude: first2.longitude });
        }

        // Check if polygons overlap
        if (polygonsOverlap(coords1, coords2)) {
          setSaveError(`The map is overlapping. Please draw the map correctly. Areas "${area1.label}" and "${area2.label}" are overlapping.`);
          setTimeout(() => setSaveError(null), 5000);
          return;
        }
      }
    }

    const payload: DeliveryAreaPayload[] = areas.map((area, index) => {
      // Ensure coordinates are valid
      if (!area.coordinates || area.coordinates.length < 3) {
        console.warn(`Area "${area.label}" has invalid coordinates:`, area.coordinates);
        throw new Error(`Area "${area.label || `Area ${index + 1}`}" must have at least 3 points`);
      }

      // Ensure polygon is closed (first and last point should be the same)
      let coordinates = [...area.coordinates];
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      
      // Close the polygon if not already closed
      if (first.latitude !== last.latitude || first.longitude !== last.longitude) {
        coordinates.push({ latitude: first.latitude, longitude: first.longitude });
      }

      return {
        label: area.label || `Zone ${index + 1}`,
        coordinates: coordinates,
      };
    });

    console.log('Payload to save:', payload);

    try {
      const result = await saveMutation.mutateAsync(payload);
      console.log('Save successful, result:', result);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving delivery areas:', error);
      let errorMessage = 'Failed to save delivery areas';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setSaveError(errorMessage);
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  if (!selectedShopId) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-600 text-lg">Please select a shop to manage delivery areas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Areas</h2>
        <p className="text-gray-600">Draw zones on the map to define where you deliver</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Map</h3>
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={handleStartDrawing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                  >
                    <Plus size={18} />
                    Draw New Area
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Finish button clicked, state:', {
                          verticesCount: editingVertices.length,
                          label: currentAreaLabel,
                          labelTrimmed: currentAreaLabel.trim(),
                          isDisabled: editingVertices.length < 3 || !currentAreaLabel.trim()
                        });
                        handleFinishDrawing();
                      }}
                      disabled={editingVertices.length < 3 || !currentAreaLabel.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        editingVertices.length < 3 
                          ? `Need ${3 - editingVertices.length} more points` 
                          : !currentAreaLabel.trim() 
                          ? 'Please enter an area label'
                          : 'Finish drawing area'
                      }
                    >
                      <Save size={18} />
                      Finish
                      {editingVertices.length < 3 && (
                        <span className="text-xs">({editingVertices.length}/3)</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCancelDrawing();
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all"
                    >
                      <X size={18} />
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            {isEditing && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                <div className="mb-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    Drawing Mode Active
                  </span>
                </div>
                <input
                  type="text"
                  value={currentAreaLabel}
                  onChange={(e) => setCurrentAreaLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingVertices.length >= 3 && currentAreaLabel.trim()) {
                      e.preventDefault();
                      handleFinishDrawing();
                    }
                  }}
                  placeholder="Enter area label (e.g., Zone 1, Downtown)"
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="text-xs text-blue-600 mt-1 space-y-1">
                  <p>Click on the map to add points. Need at least 3 points to create an area.</p>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${editingVertices.length >= 3 ? 'text-green-600' : 'text-blue-600'}`}>
                      Points: {editingVertices.length}/3
                    </span>
                    {editingVertices.length >= 3 && (
                      <span className="text-green-600">✓</span>
                    )}
                  </div>
                  {editingVertices.length >= 3 && !currentAreaLabel.trim() && (
                    <p className="text-orange-600 font-semibold">⚠ Please enter an area label above</p>
                  )}
                </div>
              </div>
            )}
            <div className={`h-[600px] relative ${isEditing ? 'cursor-crosshair' : ''}`} style={{ cursor: isEditing ? 'crosshair' : 'default' }}>
              {isEditing && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span className="font-semibold text-sm">Draw Mode: Click on map to add points ({editingVertices.length}/3 minimum)</span>
                </div>
              )}
              {lastClickedCoords && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3" style={{ animation: 'fade-in 0.3s ease-out' }}>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium opacity-90">Coordinates:</span>
                    <span className="text-sm font-mono font-bold">
                      Lat: {lastClickedCoords.lat.toFixed(6)}, Lng: {lastClickedCoords.lng.toFixed(6)}
                    </span>
                  </div>
                </div>
              )}
              <WebMap
                key={`map-${selectedShopId}`} // Force re-render when shop changes to ensure fresh map
                mapRef={mapRef}
                initialRegion={{
                  latitude: shopLat,
                  longitude: shopLng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onMapClick={handleMapClick}
                showDeliveryLabel={false}
                showShopMarker={true}
                showGeolocationButton={true}
                shopName={selectedShop?.name || 'Shop'}
                isDrawMode={isEditing}
                polygons={[
                  // Existing areas
                  ...areas.map((area, index) => ({
                    coordinates: area.coordinates,
                    color: `hsl(${(index * 60) % 360}, 70%, 50%)`,
                  })),
                  // Currently editing polygon
                  ...(isEditing && editingVertices.length > 0 ? [{
                    coordinates: editingVertices.length >= 3 
                      ? [...editingVertices, editingVertices[0]] // Close polygon
                      : editingVertices,
                    color: '#10B981', // Green for editing
                  }] : [])
                ]}
                markers={[
                  // Markers for editing vertices only (shop marker is handled by showShopMarker)
                  ...(isEditing ? editingVertices.map((vertex, index) => ({
                    latitude: vertex.latitude,
                    longitude: vertex.longitude,
                    title: `Point ${index + 1}`,
                    icon: `${index + 1}`, // Use number instead of emoji for better visibility
                  })) : [])
                ]}
              />
            </div>
          </div>
        </div>

        {/* Areas List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Delivery Areas ({areas.length})</h3>
            </div>
            <div className="p-4">
              {/* Success/Error Messages */}
              {saveSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 text-sm font-semibold">✓ Delivery areas saved successfully!</p>
                </div>
              )}
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm font-semibold">✗ {saveError}</p>
                </div>
              )}
              {isLoading ? (
                <LoadingSpinner text="Loading areas..." />
              ) : areas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No delivery areas yet.</p>
                  <p className="text-sm mt-2">Click "Draw New Area" to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {areas.map((area, index) => (
                    <div
                      key={index}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {deletingAreaIndex === index ? (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-700 text-sm font-semibold mb-2">
                            Are you sure you want to delete "{area.label}"?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={confirmDeleteArea}
                              className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={cancelDeleteArea}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{area.label}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {area.coordinates.length} points
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditArea(index)}
                              disabled={isEditing}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteArea(index)}
                              disabled={isEditing}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {areas.length > 0 && (
                <button
                  onClick={handleSaveAreas}
                  disabled={saveMutation.isLoading || isEditing}
                  className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveMutation.isLoading ? 'Saving...' : 'Save All Areas'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

