import { create } from "zustand";
import type { FeatureCollection } from "geojson";

interface GeoDataState {
  geoData: FeatureCollection | null;
  isClient: boolean;
  setGeoData: (data: FeatureCollection) => void;
  setIsClient: (value: boolean) => void;
}

export const useGeoData = create<GeoDataState>((set) => ({
  geoData: null,
  isClient: false,
  setGeoData: (data) => set({ geoData: data }),
  setIsClient: (value) => set({ isClient: value }),
}));

