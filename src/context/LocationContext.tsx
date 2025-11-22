import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { useLocationStore } from '../stores/locationStore';

export type Coordinates = { latitude: number; longitude: number };

export type SelectedAddress = {
  label: string; // e.g., "Ambasoft Street 14"
  city: string; // e.g., "Lahore"
  coords?: Coordinates | null;
  isCurrent?: boolean; // true if derived from GPS
  addressId?: string | null;
};

type LocationContextValue = {
  selectedAddress: SelectedAddress | null;
  setSelectedAddress: (addr: SelectedAddress | null) => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedAddress, setSelectedAddressState] = useState<SelectedAddress | null>(null);
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);
  const setConfirmedLocation = useLocationStore((state) => state.setConfirmedLocation);

  // Initialize from Zustand store on mount
  useEffect(() => {
    if (confirmedLocation && !selectedAddress) {
      setSelectedAddressState({
        label: confirmedLocation.streetLine || confirmedLocation.address,
        city: confirmedLocation.city || '',
        coords: confirmedLocation.coords,
        isCurrent: false,
        addressId: confirmedLocation.addressId ?? null,
      });
    }
  }, [confirmedLocation, selectedAddress]);

  // Wrapper function that updates both context and persisted store
  const setSelectedAddress = (addr: SelectedAddress | null) => {
    setSelectedAddressState(addr);
    
    // Also persist to Zustand store (localStorage) if address has coordinates
    if (addr && addr.coords) {
      setConfirmedLocation({
        coords: addr.coords,
        addressId: addr.addressId ?? null,
        address: addr.label,
        city: addr.city,
        streetLine: addr.label,
        timestamp: Date.now(),
      });
    } else if (addr === null) {
      // If clearing address, also clear from store
      useLocationStore.getState().clearLocation();
    }
  };

  const value = useMemo(() => ({ selectedAddress, setSelectedAddress }), [selectedAddress]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationSelection(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationSelection must be used within LocationProvider');
  return ctx;
}


