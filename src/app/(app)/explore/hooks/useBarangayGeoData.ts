"use client";

import { useState, useEffect } from "react";
import * as turf from "@turf/turf";
import type { BarangayData } from "@/context/BarangayContext";
import { getLevel } from "@/lib/api/greenery_index";

interface StaticBarangayRow {
  name: string;
  greenery_index: number;
  ndvi: number;
  lst: number;
  tree_canopy: number;
  flood_exposure: string;
  current_intervention: string;
}

/**
 * Loads barangay metrics from static GeoJSON files (no API call needed).
 * Returns the geo data array and a loading flag.
 */
export function useBarangayGeoData() {
  const [geoData, setGeoData] = useState<BarangayData[] | null>(null);
  const [geoDataLoading, setGeoDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStaticBarangayData() {
      try {
        const [metricsRes, boundariesRes] = await Promise.all([
          fetch("/geo/mandaue_barangays_gi.geojson"),
          fetch("/geo/mandaue_barangay_boundaries.json"),
        ]);

        if (!metricsRes.ok || !boundariesRes.ok) return;

        const metricsList = (await metricsRes.json()) as StaticBarangayRow[];
        const boundaries =
          (await boundariesRes.json()) as GeoJSON.FeatureCollection;

        if (cancelled) return;

        const mapped: BarangayData[] = metricsList
          .filter((item) => typeof item.name === "string" && item.name)
          .map((item) => {
            const boundaryFeature = boundaries.features.find(
              (f) =>
                f.properties?.name?.toLowerCase() ===
                item.name.toLowerCase(),
            );
            const areaHectares = boundaryFeature
              ? turf.area(boundaryFeature as GeoJSON.Feature) / 10000
              : undefined;

            return {
              name: item.name,
              greeneryIndex: item.greenery_index ?? 0,
              ndvi: item.ndvi ?? 0,
              lst: item.lst ?? 0,
              treeCanopy: item.tree_canopy ?? 0,
              greeneryLevel: getLevel(item.greenery_index ?? 0),
              taggedTreeCount: 0,
              inventoryCanopyFraction: 0,
              areaHectares,
              floodExposure: item.flood_exposure ?? "",
              currentIntervention: item.current_intervention ?? "",
            } as BarangayData;
          });

        if (!cancelled) {
          setGeoData(mapped);
          setGeoDataLoading(false);
        }
      } catch (error) {
        console.error("Failed to load static barangay data:", error);
        if (!cancelled) setGeoDataLoading(false);
      }
    }

    loadStaticBarangayData();
    return () => {
      cancelled = true;
    };
  }, []);

  return { geoData, geoDataLoading } as const;
}
