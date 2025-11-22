import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import { useLocationSelection } from '../../context/LocationContext';
import { useLocationStore } from '../../stores/locationStore';
import { useUserLocation } from './useUserLocation';
import { findShopsByLocation } from '../../services/consumer/shopService';
import { calculateShopsDeliveryFees } from '../../services/consumer/deliveryFeeService';
import type { ConsumerShop } from '../../services/consumer/shopService';

interface ShopsState {
  shops: ConsumerShop[];
  loading: boolean;
  error: string | null;
}

type ShopsAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_SHOPS'; shops: ConsumerShop[] }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' };

function shopsReducer(state: ShopsState, action: ShopsAction): ShopsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_SHOPS':
      return { ...state, shops: action.shops, loading: false, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'RESET':
      return { shops: [], loading: false, error: null };
    default:
      return state;
  }
}

export function useShopsByLocation() {
  const { selectedAddress } = useLocationSelection();
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);
  const { coords: userCoords, loading: userLocationLoading } = useUserLocation();
  const [state, dispatch] = useReducer(shopsReducer, {
    shops: [],
    loading: false,
    error: null,
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCoordsRef = useRef<string | null>(null);
  const locationWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    // Determine which coordinates to use
    // Priority: selectedAddress.coords > confirmedLocation > userCoords
    const coords = selectedAddress?.coords || confirmedLocation?.coords || userCoords;

    // Create a unique key for these coordinates to prevent duplicate fetches
    const coordsKey = coords 
      ? `${coords.latitude?.toFixed(6)}_${coords.longitude?.toFixed(6)}` 
      : null;

    // Handle case when no coordinates are available
    if (!coords || !coords.latitude || !coords.longitude) {
      // Set up timeout for location loading if no address is selected
      if (userLocationLoading && !selectedAddress?.coords && !confirmedLocation?.coords) {
        // Wait up to 5 seconds for location to load
        if (locationWaitTimeoutRef.current) {
          clearTimeout(locationWaitTimeoutRef.current);
        }
        locationWaitTimeoutRef.current = setTimeout(() => {
          if (isMounted) {
            dispatch({ type: 'SET_ERROR', error: 'Location is taking too long to load. Please select an address manually.' });
          }
        }, 5000);
        // Keep loading state while waiting for location
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', loading: true });
        }
      } else {
        // Clear location wait timeout if we have coordinates or location is done loading
        if (locationWaitTimeoutRef.current) {
          clearTimeout(locationWaitTimeoutRef.current);
          locationWaitTimeoutRef.current = null;
        }
        if (isMounted) {
          dispatch({ type: 'RESET' });
        }
      }
      
      return () => {
        isMounted = false;
        if (locationWaitTimeoutRef.current) {
          clearTimeout(locationWaitTimeoutRef.current);
        }
      };
    }

    // Clear location wait timeout since we have coordinates
    if (locationWaitTimeoutRef.current) {
      clearTimeout(locationWaitTimeoutRef.current);
      locationWaitTimeoutRef.current = null;
    }

    // If coordinates haven't changed, don't refetch
    // But allow refetch if we don't have shops yet (initial load or after error)
    // OR if refreshTrigger changed (e.g., after order completion)
    const coordinatesChanged = coordsKey !== lastCoordsRef.current;
    const shouldSkipFetch = coordsKey && !coordinatesChanged && state.shops.length > 0 && !state.error && refreshTrigger === 0;
    
    if (shouldSkipFetch) {
      return () => {
        isMounted = false;
      };
    }

    // If coordinates changed, clear shops and reset the last coords ref to allow refetch
    if (coordinatesChanged && coordsKey) {
      // Clear existing shops when location changes (fetch will set loading)
      if (isMounted && state.shops.length > 0) {
        // Use RESET to clear shops, then set loading
        dispatch({ type: 'RESET' });
        dispatch({ type: 'SET_LOADING', loading: true });
      }
      lastCoordsRef.current = coordsKey;
    } else if (coordsKey && !lastCoordsRef.current) {
      // Initialize lastCoordsRef if it's null
      lastCoordsRef.current = coordsKey;
    }

    const fetchShops = async () => {
      // Clear any existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Set loading state
      if (isMounted) {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_ERROR', error: null });
      }

      // Create abort controller for cancellation
      abortController = new AbortController();

      // Set a timeout to prevent infinite loading (60 seconds - increased to match fetch timeout)
      timeoutRef.current = setTimeout(() => {
        if (isMounted) {
          console.warn('Shop fetch timeout - taking too long');
          dispatch({ type: 'SET_ERROR', error: 'Loading shops is taking longer than expected. Please try again.' });
        }
      }, 60000);

      try {
        console.log('Fetching shops for location:', { latitude: coords.latitude, longitude: coords.longitude });
        
        // Fetch shops - the function now has its own 3s timeout and simplified fallback (3s)
        // Overall timeout of 15s to allow RPC (3s) + fallback (3s) + network buffer
        const shopPromise = findShopsByLocation(coords.latitude, coords.longitude);
        const timeoutPromise = new Promise<{ data: ConsumerShop[]; error: null }>((resolve) => {
          setTimeout(
            () => {
              // Only log if we're still loading (not already resolved)
              if (isMounted && !abortController?.signal.aborted) {
                console.warn('Overall shop fetch timeout - returning empty results');
              }
              resolve({
                data: [],
                error: null, // Return empty array instead of error for better UX
              });
            },
            15000 // 15 second overall timeout (RPC 3s + fallback 3s + network buffer)
          );
        });
        
        const result: any = await Promise.race([shopPromise, timeoutPromise]);
        
        // Only log if we got actual results or a real error (not timeout)
        if (result.data && result.data.length > 0) {
          console.log('Shop fetch result:', { shopsCount: result.data.length });
        } else if (result.error && result.error.code !== 'TIMEOUT') {
          console.log('Shop fetch result:', { shopsCount: 0, error: result.error.message });
        }

        if (!isMounted || abortController?.signal.aborted) return;

        // Clear timeout on success
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Always set shops data - if there's an error, result.data will be empty array
        // This provides better UX than showing error messages
        if (result.error && result.error.code !== 'TIMEOUT') {
          // Only log non-timeout errors
          console.warn('Error fetching shops (non-timeout):', result.error);
        }
        
        // Set shops regardless of error - empty array is better than error message
        const shopsData = result.data || [];
        
        // Only log if we have shops or a non-timeout error
        if (shopsData.length === 0 && result.error && result.error.code !== 'TIMEOUT') {
          console.log('No shops found for location');
        }
        
        // Always dispatch shops data (even if empty) - better UX than showing errors
        if (isMounted && !abortController?.signal.aborted) {
          if (shopsData.length > 0) {
            console.log('Setting shops:', shopsData.length);
          
          // Calculate delivery fees based on distance tiering (with timeout)
            if (coords) {
            try {
              // Calculate fees with a timeout
              const feePromise = calculateShopsDeliveryFees(
                shopsData,
                coords.latitude,
                coords.longitude
              );
              const feeTimeoutPromise = new Promise<ConsumerShop[]>((_, reject) => {
                  setTimeout(() => reject(new Error('Fee calculation timeout')), 8000); // Reduced timeout
              });
              
              const shopsWithFees = await Promise.race([feePromise, feeTimeoutPromise]);
              
              if (isMounted && !abortController?.signal.aborted) {
                dispatch({ type: 'SET_SHOPS', shops: shopsWithFees });
                  dispatch({ type: 'SET_ERROR', error: null }); // Clear any previous errors
              }
            } catch (feeError) {
                console.warn('Error calculating delivery fees (using shops without fees):', feeError);
                // Use shops without fees if calculation fails - still better than showing error
              if (isMounted && !abortController?.signal.aborted) {
                dispatch({ type: 'SET_SHOPS', shops: shopsData });
                  dispatch({ type: 'SET_ERROR', error: null }); // Clear any previous errors
              }
            }
          } else {
              dispatch({ type: 'SET_SHOPS', shops: shopsData });
              dispatch({ type: 'SET_ERROR', error: null }); // Clear any previous errors
            }
          } else {
            // No shops found - set empty array and clear errors
            dispatch({ type: 'SET_SHOPS', shops: [] });
            dispatch({ type: 'SET_ERROR', error: null }); // Don't show error for empty results
          }
        }
      } catch (err: any) {
        if (!isMounted || abortController?.signal.aborted) return;
        
        // Clear timeout on error
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        console.error('Exception fetching shops:', err);
        if (isMounted) {
          dispatch({ type: 'SET_ERROR', error: err?.message || 'An error occurred while loading shops' });
          dispatch({ type: 'SET_SHOPS', shops: [] });
        }
      }
    };

    // Debounce the fetch to prevent rapid re-fetches
    const debounceTimer = setTimeout(() => {
      fetchShops();
    }, 300); // 300ms debounce

    return () => {
      isMounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (locationWaitTimeoutRef.current) {
        clearTimeout(locationWaitTimeoutRef.current);
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [
    selectedAddress?.coords?.latitude,
    selectedAddress?.coords?.longitude,
    confirmedLocation?.coords?.latitude,
    confirmedLocation?.coords?.longitude,
    userCoords?.latitude,
    userCoords?.longitude,
    userLocationLoading,
    refreshTrigger, // Include refreshTrigger in dependencies to trigger refetch
  ]);

  // Expose refetch function - optimized for fast refetch
  const refetch = useCallback(() => {
    console.log('🔄 Force refetching shops (fast)...');
    // Clear last coords to force refetch
    lastCoordsRef.current = null;
    // Reset shops state to show loading immediately
    dispatch({ type: 'SET_LOADING', loading: true });
    dispatch({ type: 'SET_ERROR', error: null });
    // Increment refresh trigger to force effect to re-run immediately
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return { shops: state.shops, loading: state.loading, error: state.error, refetch };
}

