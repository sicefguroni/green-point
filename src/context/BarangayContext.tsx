"use client"

import { createContext, useContext, useState, ReactNode } from "react";

interface BarangayData {
  name: string;
  greeneryIndex: number;
  ndvi: number;
  lst: number;
  treeCanopy: number; 
}

interface BarangayContextType {
  selectedBarangay: BarangayData | null;
  setSelectedBarangay: (barangay: BarangayData | null) => void;
}

const BarangayContext = createContext<BarangayContextType | undefined>(undefined);

export const BarangayProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayData | null>(null);

  return (
    <BarangayContext.Provider value={{ selectedBarangay, setSelectedBarangay }}>
      {children}
    </BarangayContext.Provider>
  )
}

export function useBarangay() {
  const context = useContext(BarangayContext)
  if (!context) {
    throw new Error("useBarangay must be used within a BarangayProvider")
  }
  return context;
}