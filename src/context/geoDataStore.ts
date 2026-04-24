import { create } from "zustand";
import type { FeatureCollection } from "geojson";

export interface MapView {
  center: [number, number];
  zoom: number;
}

interface GeoDataState {
  geoData: FeatureCollection | null;
  isClient: boolean;
  mapView: MapView | null;
  setGeoData: (data: FeatureCollection) => void;
  setIsClient: (value: boolean) => void;
  setMapView: (view: MapView) => void;
}

export const useGeoData = create<GeoDataState>((set) => ({
  geoData: null,
  isClient: false,
  mapView: null,
  setGeoData: (data) => set({ geoData: data }),
  setIsClient: (value) => set({ isClient: value }),
  setMapView: (view) => set({ mapView: view }),
}));
