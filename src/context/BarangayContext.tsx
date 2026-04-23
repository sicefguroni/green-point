"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";

export interface BarangayData {
  name: string;
  greeneryIndex: number;
  ndvi: number;
  lst: number;
  treeCanopy: number;
  floodExposure: string;
  currentIntervention: string;
}

interface BarangayContextType {
  selectedBarangay: BarangayData | null;
  setSelectedBarangay: (barangay: BarangayData | null) => void;
  simulationBarangay: BarangayData | null;
  setSimulationBarangay: (barangay: BarangayData | null) => void;
}

interface BarangayActionsContextType {
  setSelectedBarangay: (barangay: BarangayData | null) => void;
  setSimulationBarangay: (barangay: BarangayData | null) => void;
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
  const contextValue = useMemo(
    () => ({
      selectedBarangay,
      setSelectedBarangay,
      simulationBarangay,
      setSimulationBarangay,
    }),
    [selectedBarangay, simulationBarangay],
  );
  const actionsValue = useMemo(
    () => ({
      setSelectedBarangay,
      setSimulationBarangay,
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
