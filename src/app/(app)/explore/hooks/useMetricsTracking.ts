"use client";

import { useCallback } from "react";

/**
 * Provides a callback to POST location metrics to the tracking API.
 */
export function useMetricsTracking() {
  const trackLocationMetrics = useCallback(
    async (
      type: "BARANGAY" | "POINT" | "CUSTOM",
      name: string,
      metrics: {
        ndvi?: number | null;
        lst?: number | null;
        treeCanopy?: number | null;
        greeneryIndex?: number | null;
        greeneryLevel?: string | null;
        aqi?: number | null;
      },
      id?: string | null,
      coords?: { lat: number; lng: number } | null,
    ) => {
      try {
        await fetch("/api/metrics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationType: type,
            locationId: id,
            locationName: name,
            coordinates: coords,
            ...metrics,
          }),
        });
      } catch (err) {
        console.error("Failed to track metrics:", err);
      }
    },
    [],
  );

  return { trackLocationMetrics } as const;
}
