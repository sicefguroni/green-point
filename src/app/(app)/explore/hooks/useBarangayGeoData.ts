"use client";

import { useState, useEffect } from "react";
import type { BarangayData } from "@/context/BarangayContext";
import { fetchGreeneryIndexResourceDeduped } from "@/lib/data-api/greenery-index-resource-client";
import {
  buildExploreBarangayData,
  type StaticBarangayLabels,
} from "@/lib/map/explore-barangay-data";

/**
 * Loads Explore's per-barangay metrics from the live greenery-index data (the
 * same source as the dashboard), with flood and intervention labels from the
 * static GeoJSON. If the live data can't be loaded, the list is empty, so the
 * panel shows no metrics instead of placeholder numbers.
 * Returns the geo data array and a loading flag.
 */
export function useBarangayGeoData() {
  const [geoData, setGeoData] = useState<BarangayData[] | null>(null);
  const [geoDataLoading, setGeoDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadBarangayData() {
      try {
        const [boundariesRes, live, labelsRes] = await Promise.all([
          fetch("/geo/mandaue_barangay_boundaries.json"),
          fetchGreeneryIndexResourceDeduped(),
          fetch("/geo/mandaue_barangays_gi.geojson"),
        ]);

        if (!boundariesRes.ok) throw new Error("Barangay boundaries failed to load");
        const boundaries = (await boundariesRes.json()) as GeoJSON.FeatureCollection;
        const labels = labelsRes.ok
          ? ((await labelsRes.json()) as StaticBarangayLabels[])
          : [];

        if (!live.ok) {
          console.error(
            `Live barangay metrics failed to load (HTTP ${live.status}); Explore will show no barangay metrics.`,
          );
        }
        const mapped = live.ok
          ? buildExploreBarangayData(boundaries, live.data, labels)
          : [];

        if (!cancelled) {
          setGeoData(mapped);
          setGeoDataLoading(false);
        }
      } catch (error) {
        console.error("Failed to load barangay data:", error);
        if (!cancelled) {
          setGeoData([]);
          setGeoDataLoading(false);
        }
      }
    }

    void loadBarangayData();
    return () => {
      cancelled = true;
    };
  }, []);

  return { geoData, geoDataLoading } as const;
}
