import React, { useEffect, useRef, useState, isValidElement } from 'react';
import { getEnvVar } from '../../../src/services/env';
import PinMarker from '../../../src/icons/PinMarker';
import CenterHairline from '../../../src/icons/CenterHairline';

export interface WebMapProps {
  mapRef?: React.RefObject<any>;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onTouchStart?: () => void;
  onRegionChangeComplete?: (region: any) => void;
  onTouchEnd?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
  isMoving?: boolean;
  markerOffsetY?: number;
  showsUserLocation?: boolean;
  polygons?: Array<{ coordinates: Array<{ latitude: number; longitude: number }>; color?: string }>;
  markers?: Array<{ latitude: number; longitude: number; icon?: React.ReactNode; title?: string }>;
  showDeliveryLabel?: boolean; // Control whether to show "We'll deliver here" label
  showShopMarker?: boolean; // Show shop marker at initial region
  showGeolocationButton?: boolean; // Show button to center on shop location
  shopName?: string; // Shop name for marker label
  isDrawMode?: boolean; // Enable draw mode with crosshair cursor
  interactive?: boolean; // Allow user interactions
}

declare global {
  interface Window {
    google: any;
    initGoogleMap: () => void;
  }
}

export default function WebMap({
  mapRef,
  initialRegion,
  onTouchStart,
  onRegionChangeComplete,
  onTouchEnd,
  onMapClick,
  isMoving = false,
  markerOffsetY = 0,
  showsUserLocation = false,
  polygons = [],
  markers = [],
  showDeliveryLabel = true, // Default to true for backward compatibility
  showShopMarker = false, // Show shop marker
  showGeolocationButton = false, // Show geolocation button
  shopName = 'Shop', // Shop name for marker
  isDrawMode = false, // Draw mode with crosshair cursor
  interactive = true,
}: WebMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const shopMarkerInstanceRef = useRef<any>(null);
  const polygonInstancesRef = useRef<any[]>([]);
  const markerInstancesRef = useRef<any[]>([]);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps JavaScript API
    const loadGoogleMaps = async () => {
      // Check if already loaded and Map constructor is available
      if (window.google && window.google.maps && window.google.maps.Map) {
        setIsGoogleMapsLoaded(true);
        return;
      }

      // Check if script is already being loaded
      if (document.getElementById('google-maps-script')) {
        // Wait for it to load and Map constructor to be available
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.maps && window.google.maps.Map) {
            setIsGoogleMapsLoaded(true);
            clearInterval(checkLoaded);
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkLoaded);
        }, 5000);
        return;
      }

      // Get API key from environment
      const apiKey = getEnvVar('GOOGLE_MAPS_API_KEY') || getEnvVar('VITE_GOOGLE_MAPS_API_KEY') || '';
      
      if (!apiKey) {
        console.error('Google Maps API key not found. Please set GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY in your .env file');
        return;
      }

      // Load Google Maps script with async loading for better performance
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry,marker&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait a bit to ensure Google Maps API is fully initialized
        // Check for Map constructor to ensure API is ready
        const checkReady = setInterval(() => {
          if (window.google && window.google.maps && window.google.maps.Map) {
            setIsGoogleMapsLoaded(true);
            clearInterval(checkReady);
            if (window.initGoogleMap) {
              window.initGoogleMap();
            }
          }
        }, 50);
        
        // Timeout after 5 seconds if still not ready
        setTimeout(() => {
          clearInterval(checkReady);
          if (window.google && window.google.maps && window.google.maps.Map) {
            setIsGoogleMapsLoaded(true);
          } else {
            console.error('Google Maps API failed to initialize after timeout');
          }
        }, 5000);
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps API');
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Initialize map when Google Maps is loaded and Map constructor is available
  useEffect(() => {
    // Ensure Google Maps API is fully loaded with Map constructor available
    if (!isGoogleMapsLoaded || !window.google || !window.google.maps || !window.google.maps.Map || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const google = window.google;
    const container = mapContainerRef.current;

    // Set default zoom to 15 (neighborhood level, similar to the image)
    // For latitudeDelta 0.01, this gives zoom ~15 which is perfect for neighborhood view
    const zoom = initialRegion.latitudeDelta && initialRegion.latitudeDelta > 0
      ? Math.max(10, Math.min(20, Math.round(Math.log2(360 / initialRegion.latitudeDelta))))
      : 15;

    const googleMap = new google.maps.Map(container, {
      center: { lat: initialRegion.latitude, lng: initialRegion.longitude },
      zoom: zoom,
      zoomControl: interactive,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: interactive,
      // Disable default markers - we use custom overlay markers
      disableDefaultUI: false,
      draggable: interactive,
      scrollwheel: interactive,
      disableDoubleClickZoom: !interactive,
      keyboardShortcuts: interactive,
      gestureHandling: interactive ? 'auto' : 'none',
    });

    mapInstanceRef.current = googleMap;
    setMap(googleMap);

    // Add shop marker if needed - Better visible pin marker
    // Note: Using deprecated google.maps.Marker for now, but AdvancedMarkerElement is recommended
    // Migration to AdvancedMarkerElement requires PinElement and is more complex
    if (showShopMarker) {
      // Create a better shop marker with a clear pin design
      const shopMarkerSvg = `
        <svg width="50" height="64" viewBox="0 0 50 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Pin shadow -->
          <ellipse cx="25" cy="60" rx="10" ry="4" fill="#00000030"/>
          <!-- Pin body - teardrop shape -->
          <path d="M25 0C17.268 0 11 6.26801 11 14C11 20.5 25 48 25 48C25 48 39 20.5 39 14C39 6.26801 32.732 0 25 0Z" fill="#3B82F6" stroke="#1E40AF" stroke-width="2.5"/>
          <!-- White circle for icon background -->
          <circle cx="25" cy="20" r="10" fill="white" stroke="#1E40AF" stroke-width="1.5"/>
          <!-- Shop icon - building/shop symbol -->
          <path d="M20 15H30V25H20V15Z" fill="#3B82F6"/>
          <rect x="22" y="17" width="2" height="2" fill="white"/>
          <rect x="26" y="17" width="2" height="2" fill="white"/>
          <rect x="22" y="21" width="2" height="2" fill="white"/>
          <rect x="26" y="21" width="2" height="2" fill="white"/>
          <line x1="20" y1="25" x2="30" y2="25" stroke="#1E40AF" stroke-width="1.5"/>
        </svg>
      `;
      
      // Use deprecated Marker for now (will need migration to AdvancedMarkerElement in future)
      const shopMarker = new google.maps.Marker({
        position: { lat: initialRegion.latitude, lng: initialRegion.longitude },
        map: googleMap,
        icon: {
          url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shopMarkerSvg),
          scaledSize: new google.maps.Size(50, 64),
          anchor: new google.maps.Point(25, 64), // Anchor at bottom center of pin
        },
        title: shopName,
        zIndex: 1000,
        optimized: false, // Better rendering quality, prevents flickering
        animation: null, // No animation to prevent blinking
      });

      shopMarkerInstanceRef.current = shopMarker;

      // Add info window for shop marker
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px; font-weight: 600; color: #1f2937;">${shopName}</div>`,
      });

      shopMarker.addListener('click', () => {
        infoWindow.open(googleMap, shopMarker);
      });
    }

    // Add center pin marker if needed (using teardrop shape)
    // Only create Google Maps marker if showsUserLocation is true AND we're not using the overlay
    if (showsUserLocation && !showDeliveryLabel) {
      // Create teardrop pin marker SVG (same as PinMarker component)
      // Note: Using deprecated google.maps.Marker - will need migration to AdvancedMarkerElement
      const teardropPinSvg = `<svg width="50" height="50" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2c-3.314 0-6 2.686-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" fill="#3B82F6"/>
        <circle cx="12" cy="8" r="2.5" fill="#ffffff"/>
      </svg>`;
      
      // Use deprecated Marker for now (will need migration to AdvancedMarkerElement in future)
      const pinMarker = new google.maps.Marker({
        position: { lat: initialRegion.latitude, lng: initialRegion.longitude },
        map: googleMap,
        icon: {
          url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(teardropPinSvg),
          scaledSize: new google.maps.Size(50, 50),
          anchor: new google.maps.Point(12, 24), // Anchor at bottom center of teardrop
        },
        draggable: interactive,
        optimized: false, // Better rendering quality, prevents flickering
        animation: null, // No animation to prevent blinking
      });

      markerInstanceRef.current = pinMarker;
      setMarker(pinMarker);

      // Update marker position when map center changes
      googleMap.addListener('center_changed', () => {
        const center = googleMap.getCenter();
        if (center && pinMarker) {
          pinMarker.setPosition(center);
        }
      });
    }

    // Handle map drag events
    let dragStartTime = 0;
    const DRAG_THRESHOLD_MS = 200; // Consider it a drag if longer than 200ms
    
    if (interactive) {
      googleMap.addListener('dragstart', () => {
        dragStartTime = Date.now();
        setIsDragging(true);
        if (onTouchStart) onTouchStart();
      });

      googleMap.addListener('dragend', () => {
        setIsDragging(false);
        if (onTouchEnd) onTouchEnd();
      });
    }

    // Handle region change
    if (interactive && onRegionChangeComplete) {
      const handleMapIdle = () => {
        const center = googleMap.getCenter();
        if (center) {
          onRegionChangeComplete({
            latitude: center.lat(),
            longitude: center.lng(),
            latitudeDelta: 360 / Math.pow(2, googleMap.getZoom() || 15),
            longitudeDelta: 360 / Math.pow(2, googleMap.getZoom() || 15),
          });
        }
      };
      googleMap.addListener('idle', handleMapIdle);
    }

    // Handle map clicks - improved detection
    if (interactive && onMapClick) {
      const clickListener = googleMap.addListener('click', (e: any) => {
        // Check if this was a quick click (not a drag)
        const clickTime = Date.now();
        const timeSinceDragStart = clickTime - dragStartTime;
        
        console.log('Map click event fired:', {
          hasLatLng: !!e.latLng,
          timeSinceDragStart,
          dragStartTime,
          willTrigger: e.latLng && (timeSinceDragStart < DRAG_THRESHOLD_MS || dragStartTime === 0)
        });
        
        // Only trigger if it's a quick click (less than threshold) or no drag started
        if (e.latLng && (timeSinceDragStart < DRAG_THRESHOLD_MS || dragStartTime === 0)) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          console.log('Calling onMapClick with:', lat, lng);
          onMapClick(lat, lng);
        }
        // Reset drag start time after click
        dragStartTime = 0;
      });
      
      // Store listener for cleanup if needed
      (googleMap as any)._clickListener = clickListener;
    }

    // Expose map methods via ref
    if (mapRef) {
      (mapRef as any).current = {
        animateCamera: (options: { center: { latitude: number; longitude: number }; zoom?: number }, config?: { duration?: number }) => {
          const target = { lat: options.center.latitude, lng: options.center.longitude };
          const targetZoom = options.zoom || googleMap.getZoom() || 15;
          googleMap.panTo(target);
          googleMap.setZoom(targetZoom);
        },
        getCamera: async () => {
          const center = googleMap.getCenter();
          return {
            center: {
              latitude: center?.lat() || initialRegion.latitude,
              longitude: center?.lng() || initialRegion.longitude,
            },
            zoom: googleMap.getZoom() || 15,
          };
        },
        getCenter: async () => {
          const center = googleMap.getCenter();
          return {
            latitude: center?.lat() || initialRegion.latitude,
            longitude: center?.lng() || initialRegion.longitude,
          };
        },
      };
    }

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        // Clean up shop marker
        if (shopMarkerInstanceRef.current) {
          shopMarkerInstanceRef.current.setMap(null);
          shopMarkerInstanceRef.current = null;
        }
        // Google Maps doesn't need explicit cleanup, but we can clear refs
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
        setMap(null);
        setMarker(null);
      }
    };
  }, [isGoogleMapsLoaded, initialRegion.latitude, initialRegion.longitude, showShopMarker, shopName, interactive, showDeliveryLabel, showsUserLocation]);

  // Update map center when initialRegion changes (preserve user zoom)
  useEffect(() => {
    if (map && initialRegion && mapContainerRef.current && mapInstanceRef.current) {
      try {
        const center = map.getCenter();
        const newCenter = { lat: initialRegion.latitude, lng: initialRegion.longitude };
        
        if (center) {
          const currentLat = center.lat();
          const currentLng = center.lng();
          
          // Only update if center actually changed (more lenient threshold for shop changes)
          if (Math.abs(currentLat - initialRegion.latitude) > 0.0001 || 
              Math.abs(currentLng - initialRegion.longitude) > 0.0001) {
            // Use panTo for smoother transition - preserve current zoom level
            map.panTo(newCenter);
            // Don't reset zoom - let user control zoom manually
          }
        } else {
          // Only set center and zoom on initial load
          map.setCenter(newCenter);
          const zoom = initialRegion.latitudeDelta && initialRegion.latitudeDelta > 0
            ? Math.max(10, Math.min(20, Math.round(Math.log2(360 / initialRegion.latitudeDelta))))
            : 15;
          map.setZoom(zoom);
        }

        // Update shop marker position if it exists
        if (showShopMarker && shopMarkerInstanceRef.current && window.google) {
          shopMarkerInstanceRef.current.setPosition(newCenter);
          // Also update the marker title if shop name changed
          if (shopName && shopMarkerInstanceRef.current.getTitle() !== shopName) {
            shopMarkerInstanceRef.current.setTitle(shopName);
          }
        }
      } catch (error) {
        console.warn('Error updating map view:', error);
      }
    }
  }, [map, initialRegion.latitude, initialRegion.longitude, initialRegion.latitudeDelta, showShopMarker, shopName]);

  // Update cursor style when draw mode changes
  useEffect(() => {
    if (mapContainerRef.current) {
      const container = mapContainerRef.current;
      if (isDrawMode) {
        container.style.cursor = 'crosshair';
        // Also apply to all child elements (Google Maps creates its own divs)
        const allChildren = container.querySelectorAll('*');
        allChildren.forEach((child: any) => {
          if (child.style) {
            child.style.cursor = 'crosshair';
          }
        });
      } else {
        container.style.cursor = 'default';
        const allChildren = container.querySelectorAll('*');
        allChildren.forEach((child: any) => {
          if (child.style && child.style.cursor === 'crosshair') {
            child.style.cursor = 'default';
          }
        });
      }
    }
  }, [isDrawMode]);

  // Ensure click listener is attached when onMapClick changes
  useEffect(() => {
    if (map && onMapClick && mapInstanceRef.current) {
      // The click listener is already attached in the initialization useEffect
      // But we can verify it's working by checking the map instance
      console.log('Map click handler available:', !!onMapClick);
    }
  }, [map, onMapClick]);

  // Add polygons to map
  useEffect(() => {
    if (map && window.google && mapContainerRef.current) {
      const google = window.google;
      
      // Remove existing polygons
      polygonInstancesRef.current.forEach((polygon) => {
        try {
          polygon.setMap(null);
        } catch (e) {
          console.warn('Error removing polygon:', e);
        }
      });
      polygonInstancesRef.current = [];

      // Add new polygons
      polygons.forEach((polygon) => {
        if (polygon.coordinates && polygon.coordinates.length > 0) {
          try {
            const path = polygon.coordinates.map((coord) => ({
              lat: coord.latitude,
              lng: coord.longitude,
            }));

            const polygonInstance = new google.maps.Polygon({
              paths: path,
              strokeColor: polygon.color || '#3B82F6',
              strokeOpacity: 1,
              strokeWeight: 2,
              fillColor: polygon.color || '#3B82F6',
              fillOpacity: 0.2,
              map: map,
            });

            polygonInstancesRef.current.push(polygonInstance);
          } catch (e) {
            console.error('Error adding polygon:', e);
          }
        }
      });
    }
  }, [map, polygons]);

  // Add markers to map - stable rendering without blinking
  useEffect(() => {
    if (!map || !window.google || !window.google.maps || !mapContainerRef.current) {
      return;
    }

    const google = window.google;
    
    // Create a stable SVG icon (created once, reused)
    const createPinIcon = () => {
      const pinSvg = `<svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <!-- Pin body - teardrop shape (exact same as PinMarker component) -->
        <path d="M12 2c-3.314 0-6 2.686-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" fill="#3B82F6"/>
        <!-- Inner white circle/dot (exact same as PinMarker component) -->
        <circle cx="12" cy="8" r="2.5" fill="#ffffff"/>
      </svg>`;
      
      return {
        url: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(pinSvg)))}`,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 36),
      };
    };

    // Create stable icon once
    const stableIconConfig = createPinIcon();

    // Helper function to create a marker key from its data
    const getMarkerKey = (markerData: any, index: number) => {
      return `${markerData.latitude},${markerData.longitude},${index}`;
    };

    // Create a map of existing markers by key for efficient lookup
    const existingMarkersMap = new Map<string, any>();
    markerInstancesRef.current.forEach((marker, index) => {
      // Try to extract position from existing marker
      try {
        const pos = marker.getPosition();
        if (pos) {
          const key = `${pos.lat()},${pos.lng()},${index}`;
          existingMarkersMap.set(key, marker);
        }
      } catch (e) {
        // If we can't get position, use index as fallback
        existingMarkersMap.set(`unknown,${index}`, marker);
      }
    });

    // Process new markers - update existing or create new
    const newMarkers: any[] = [];
    const usedKeys = new Set<string>();

    markers.forEach((markerData, index) => {
      try {
        const key = getMarkerKey(markerData, index);
        usedKeys.add(key);
        
        let markerInstance = existingMarkersMap.get(key);
        
        if (markerInstance) {
          // Marker already exists - just update position if needed (stable, no recreation)
          const currentPos = markerInstance.getPosition();
          if (!currentPos || 
              Math.abs(currentPos.lat() - markerData.latitude) > 0.00001 ||
              Math.abs(currentPos.lng() - markerData.longitude) > 0.00001) {
            markerInstance.setPosition({ lat: markerData.latitude, lng: markerData.longitude });
          }
          // Update title if changed
          const title = (markerData as any).title || `Point ${index + 1}`;
          if (markerInstance.getTitle() !== title) {
            markerInstance.setTitle(title);
          }
        } else {
          // Create new marker (only when truly needed)
          const title = (markerData as any).title || `Point ${index + 1}`;
          markerInstance = new google.maps.Marker({
            position: { lat: markerData.latitude, lng: markerData.longitude },
            map: map,
            icon: stableIconConfig,
            draggable: false,
            title: title,
            zIndex: 1000 + index,
            optimized: false, // Better rendering quality, prevents flickering
          });
        }

        newMarkers.push(markerInstance);
      } catch (e) {
        console.error('Error processing marker:', e, markerData);
      }
    });

    // Remove markers that are no longer in the new list
    markerInstancesRef.current.forEach((marker) => {
      if (!newMarkers.includes(marker)) {
        try {
          marker.setMap(null);
        } catch (e) {
          console.warn('Error removing marker:', e);
        }
      }
    });

    // Update ref with new markers array
    markerInstancesRef.current = newMarkers;
  }, [map, markers]);

  const handleGeolocationClick = () => {
    if (map && initialRegion) {
      map.panTo({ lat: initialRegion.latitude, lng: initialRegion.longitude });
      map.setZoom(15);
    }
  };

  return (
    <div className="relative w-full h-full" style={{ pointerEvents: interactive ? 'auto' : 'none', opacity: 1 }}>
      <div 
        ref={mapContainerRef} 
        className={`w-full h-full ${isDrawMode ? 'cursor-crosshair' : ''}`}
        style={{ 
          zIndex: 1, 
          pointerEvents: interactive ? 'auto' : 'none',
          transform: 'translateZ(0)',
          willChange: 'auto',
          imageRendering: 'crisp-edges',
          WebkitFontSmoothing: 'antialiased',
          opacity: 1,
          position: 'relative',
          cursor: isDrawMode ? 'crosshair' : 'default'
        }} 
      />
      
      {/* Geolocation Button */}
      {showGeolocationButton && map && (
        <button
          onClick={handleGeolocationClick}
          className="absolute z-50 bg-white rounded-full shadow-lg p-3 hover:bg-gray-50 transition-colors border border-gray-200"
          title="Center on shop location"
          style={{ 
            zIndex: 1000,
            bottom: '12px', // Same bottom as zoom controls
            right: '60px' // Position to the left of zoom controls (which are ~45px wide)
          }}
        >
          <svg 
            className="w-6 h-6 text-blue-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
        </button>
      )}
      
      {/* Centered marker overlay */}
      {markerOffsetY !== undefined && showDeliveryLabel && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(-50%, calc(-100% + ${markerOffsetY}px))`,
            zIndex: 1000,
          }}
        >
          <div className="flex flex-col items-center">
            {/* Delivery message label */}
            <div className="mb-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap animate-pulse-subtle border border-blue-400/30">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-bold tracking-wide drop-shadow-sm">We'll deliver here</span>
            </div>
            <PinMarker size={50} color="#3B82F6" />
            {isMoving && (
              <div className="mt-0.5">
                <CenterHairline height={22} color="#3B82F6" opacity={0.9} strokeWidth={1.5} dashArray="2,2" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
