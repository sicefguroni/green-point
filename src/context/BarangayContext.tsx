"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import type { LocationSelectionMode } from "@/types/maplayers";

export interface BarangayData {
  name: string;
  greeneryIndex: number;
  ndvi: number;
  lst: number;
  treeCanopy: number;
  floodExposure: string;
  currentIntervention: string;
  greeneryLevel?: string;
  /** Polygon area in hectares; computed from GeoJSON when the barangay is selected. */
  areaHectares?: number;
  /** Number of ground-truth tagged trees recorded in this barangay's inventory. */
  taggedTreeCount?: number;
  /** Inventory-only canopy fraction (0–1). */
  inventoryCanopyFraction?: number;
  /**
   * Canonical greening strategy the dashboard chose for this barangay
   * (typically the AI's top recommendation mapped through `resolveStrategyKey`).
   * The simulation modal uses it as the default selection so the dashboard
   * recommendation and the simulation strategy step always start in sync.
   */
  recommendedStrategy?: string;
}

interface BarangayContextType {
  selectedBarangay: BarangayData | null;
  setSelectedBarangay: (barangay: BarangayData | null) => void;
  simulationBarangay: BarangayData | null;
  setSimulationBarangay: (barangay: BarangayData | null) => void;
  /**
   * Shared selection mode for the explore map. Components anywhere in the
   * tree (e.g. the dashboard's intervention table) can flip this to
   * `"barangay"` so when the user navigates to /explore the map opens in
   * barangay mode instead of the default pin mode.
   */
  mapMode: LocationSelectionMode;
  setMapMode: (mode: LocationSelectionMode) => void;
}

interface BarangayActionsContextType {
  setSelectedBarangay: (barangay: BarangayData | null) => void;
  setSimulationBarangay: (barangay: BarangayData | null) => void;
  setMapMode: (mode: LocationSelectionMode) => void;
}

const BarangayContext = createContext<BarangayContextType | undefined>(
  undefined,
);
const BarangayActionsContext = createContext<BarangayActionsContextType | undefined>(
  undefined,
);

export const BarangayProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayData | null>(
    null,
  );
  const [simulationBarangay, setSimulationBarangay] =
    useState<BarangayData | null>(null);
  const [mapMode, setMapMode] = useState<LocationSelectionMode>("poi");
  const contextValue = useMemo(
    () => ({
      selectedBarangay,
      setSelectedBarangay,
      simulationBarangay,
      setSimulationBarangay,
      mapMode,
      setMapMode,
    }),
    [selectedBarangay, simulationBarangay, mapMode],
  );
  const actionsValue = useMemo(
    () => ({
      setSelectedBarangay,
      setSimulationBarangay,
      setMapMode,
    }),
    [],
  );

  return (
    <BarangayActionsContext.Provider value={actionsValue}>
      <BarangayContext.Provider value={contextValue}>
        {children}
      </BarangayContext.Provider>
    </BarangayActionsContext.Provider>
  );
};

export function useBarangay() {
  const context = useContext(BarangayContext);
  if (!context) {
    throw new Error("useBarangay must be used within a BarangayProvider");
  }
  return context;
}

export function useBarangayActions() {
  const context = useContext(BarangayActionsContext);
  if (!context) {
    throw new Error("useBarangayActions must be used within a BarangayProvider");
  }
  return context;
}
