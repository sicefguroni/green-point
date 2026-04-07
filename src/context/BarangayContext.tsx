"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { FeatureCollection } from "geojson";

export interface BarangayData {
  name: string;
  greeneryIndex: number;
  ndvi: number;
  lst: number;
  treeCanopy: number;
  area_km2?: number;
  /** Band from composite GI (e.g. Very Low … Very High) when available */
  greeneryLevel?: string;
  /** Live AQI when available (e.g. WAQI at point) */
  aqi?: number;
  floodExposure: string;
  currentIntervention: string;
}

interface CityWideAverages {
  greeneryIndex: number;
  ndvi: number;
  lst: number;
  treeCanopy: number;
}

interface BarangayContextType {
  selectedBarangay: BarangayData | null;
  setSelectedBarangay: (barangay: BarangayData | null) => void;
  simulationBarangay: BarangayData | null;
  setSimulationBarangay: (barangay: BarangayData | null) => void;
  geoData: FeatureCollection | null;
  cityWideAverages: CityWideAverages | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const BarangayContext = createContext<BarangayContextType | undefined>(
  undefined,
);

export const BarangayProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayData | null>(
    null,
  );
  const [simulationBarangay, setSimulationBarangay] =
    useState<BarangayData | null>(null);
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cityWideAverages, setCityWideAverages] =
    useState<CityWideAverages | null>(null);

  const fetchGeoData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/greenery-index");
      const data = (await res.json()) as FeatureCollection;
      setGeoData(data);

      // Calculate averages for city-wide dashboard
      const features = data.features;
      if (features.length > 0) {
        let totalGI = 0,
          totalNDVI = 0,
          totalLST = 0,
          totalCanopy = 0;
        let count = 0;

        features.forEach((f) => {
          const p = f.properties;
          if (p) {
            totalGI += p.greeneryIndex ?? 0;
            totalNDVI += p.ndvi ?? 0;
            totalLST += p.lst ?? 0;
            totalCanopy += p.treeCanopy ?? 0;
            count++;
          }
        });

        if (count > 0) {
          setCityWideAverages({
            greeneryIndex: totalGI / count,
            ndvi: totalNDVI / count,
            lst: totalLST / count,
            treeCanopy: totalCanopy / count,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load geo data in BarangayContext:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGeoData();
  }, []);

  const contextValue = useMemo(
    () => ({
      selectedBarangay,
      setSelectedBarangay,
      simulationBarangay,
      setSimulationBarangay,
      geoData,
      cityWideAverages,
      isLoading,
      refreshData: fetchGeoData,
    }),
    [selectedBarangay, simulationBarangay, geoData, cityWideAverages, isLoading],
  );

  return (
    <BarangayContext.Provider value={contextValue}>
      {children}
    </BarangayContext.Provider>
  );
};

export function useBarangay() {
  const context = useContext(BarangayContext);
  if (!context) {
    throw new Error("useBarangay must be used within a BarangayProvider");
  }
  return context;
}
