import { useEffect, useMemo, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import Config from 'react-native-config';

export type UserLocationState = {
  addressLine: string | null;
  coords: { latitude: number; longitude: number } | null;
  loading: boolean;
  error: string | null;
  placeLabel?: string | null; // concise neighborhood/sector label
  city?: string | null;
};

export function useUserLocation(): UserLocationState {
  const [addressLine, setAddressLine] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Request location permission (Platform-specific)
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs access to your location',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error('Location permission denied');
          }
        }
        // iOS permissions are handled in Info.plist

        // Get current position
        const position = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
          );
        });

        if (!isMounted) return;
        const { latitude, longitude } = position;
        setCoords({ latitude, longitude });

        // Google Geocoding API first (key provided in app init)
        const googleKey = Config.GOOGLE_MAPS_API_KEY;
        let line: string | null = null;
        if (googleKey) {
          try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleKey}&language=en`;
            const res = await fetch(url);
            const json = await res.json();
            if (json?.status === 'OK' && Array.isArray(json.results) && json.results.length > 0) {
              const primary = json.results[0];
              // Prefer a concise label from components
              const components = primary.address_components || [];
              const streetNumber = components.find((c: any) => c.types.includes('street_number'))?.long_name;
              const route = components.find((c: any) => c.types.includes('route'))?.long_name;
              const sublocality1 = components.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name;
              const sublocality = components.find((c: any) => c.types.includes('sublocality'))?.long_name;
              const neighborhood = components.find((c: any) => c.types.includes('neighborhood'))?.long_name;
              const computedCity = components.find((c: any) => c.types.includes('locality'))?.long_name
                || components.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name;
              const region = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name;
              const part1 = [streetNumber, route].filter(Boolean).join(' ');
              line = [part1, neighborhood, city || region].filter(Boolean).join(', ')
                || primary.formatted_address
                || null;

              // Set concise place label preference order
              const concise = sublocality1 || sublocality || neighborhood || route || part1 || null;
              setPlaceLabel(concise);
              setCity(computedCity || null);
            }
          } catch (_) {
            // Ignore and fallback
          }
        }

        // If Google API didn't work or wasn't available, we already have the best data from Google's response
        // No fallback reverse geocoding since expo-location is removed

        setAddressLine(line);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || 'Failed to fetch location');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return useMemo(
    () => ({ addressLine, coords, loading, error, placeLabel, city }),
    [addressLine, coords, loading, error, placeLabel, city]
  );
}


