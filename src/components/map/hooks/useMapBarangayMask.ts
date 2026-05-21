"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { applyOverlayClipping } from "@/lib/map/layer_manager";

export function useMapBarangayMask(
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
): React.MutableRefObject<GeoJSON.MultiPolygon | null> {
  const barangayMaskRef = useRef<GeoJSON.MultiPolygon | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBarangayMask() {
      try {
        const response = await fetch("/geo/mandaue_barangay_boundaries.json");
        if (!response.ok) return;
        const data =
          (await response.json()) as GeoJSON.FeatureCollection<GeoJSON.Geometry>;
        const features = data.features ?? [];
        const polygons: number[][][][] = [];

        features.forEach((f: GeoJSON.Feature<GeoJSON.Geometry>) => {
          if (!f.geometry) return;
          if (f.geometry.type === "Polygon") {
            polygons.push(f.geometry.coordinates);
          } else if (f.geometry.type === "MultiPolygon") {
            f.geometry.coordinates.forEach((poly: number[][][]) =>
              polygons.push(poly),
            );
          }
        });

        if (!polygons.length || cancelled) return;
        barangayMaskRef.current = {
          type: "MultiPolygon",
          coordinates: polygons,
        };

        if (!cancelled && mapRef.current && mapRef.current.isStyleLoaded()) {
          applyOverlayClipping(mapRef.current);
        }
      } catch (error) {
        console.error("Failed to load barangay mask geometry:", error);
      }
    }

    loadBarangayMask();
    return () => {
      cancelled = true;
    };
  }, [mapRef]);

  return barangayMaskRef;
}
