import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ConfirmedLocation {
  coords: {
    latitude: number;
    longitude: number;
  };
  addressId?: string | null;
  address: string;
  city?: string;
  region?: string;
  streetLine?: string;
  timestamp: number;
}

interface LocationState {
  confirmedLocation: ConfirmedLocation | null;
  hasCompletedLocationSetup: boolean;
  setConfirmedLocation: (location: ConfirmedLocation) => void;
  markLocationSetupComplete: () => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      confirmedLocation: null,
      hasCompletedLocationSetup: false,
      setConfirmedLocation: (location) =>
        set({ confirmedLocation: location, hasCompletedLocationSetup: true }),
      markLocationSetupComplete: () => set({ hasCompletedLocationSetup: true }),
      clearLocation: () =>
        set({ confirmedLocation: null, hasCompletedLocationSetup: false }),
    }),
    {
      name: 'location-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

