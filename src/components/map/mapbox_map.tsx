"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapSearchBar from "./map_search";
import { type LocationSelectionMode } from "@/types/maplayers";
import { SelectedFeature } from "@/types/metrics";
import { createAQIPopup, createLSTPopup } from "@/lib/map/popups";
import {
  addBarangayBounds,
  addHazardLayers,
  syncLayerStyles,
  applyOverlayClipping,
} from "@/lib/map/layer_manager";
import { handleFeatureSelection as processFeatureSelection } from "@/lib/map/feature_selection";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

const DEFAULT_CENTER: [number, number] = [123.9427, 10.3279];
const DEFAULT_ZOOM = 12;

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  styleUrl: string;
  layerVisibility: Record<string, boolean>;
  layerColors: Record<string, string[]>;
  layerSpecificSelected: Record<string, string>;
  searchBoxLocation: string;
  onFeatureSelected?: (featureData: SelectedFeature) => void;
  onBarangaySelected?: (barangayName: string) => void;
  onMapReady?: (map: mapboxgl.Map, removeMarker: () => void) => void;
  selectionMode: LocationSelectionMode;
}

export default function MapboxMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = "w-full h-full overflow-hidden",
  styleUrl,
  layerVisibility,
  layerColors,
  layerSpecificSelected,
  searchBoxLocation,
  onFeatureSelected,
  onBarangaySelected,
  onMapReady,
  selectionMode,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const currentStyleRef = useRef(styleUrl);
  const barangayMaskRef = useRef<GeoJSON.MultiPolygon | null>(null);

  const removeMarker = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, []);

  const handleSelection = useCallback(
    async (
      feature: mapboxgl.GeoJSONFeature,
      coords: { lng: number; lat: number },
      barangay: string,
    ) => {
      if (!mapRef.current) return;
      await processFeatureSelection(
        feature,
        coords,
        barangay,
        mapRef.current,
        markerRef,
        onFeatureSelected,
      );
    },
    [onFeatureSelected],
  );

  const handleSearchRetrieve = useCallback(
    (feature: {
      geometry: { type: string; coordinates: number[] };
      properties: Record<string, unknown>;
    }) => {
      if (mapRef.current && feature.geometry.type === "Point") {
        const [lng, lat] = feature.geometry.coordinates;
        const geoFeature = feature as unknown as mapboxgl.GeoJSONFeature;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
        mapRef.current.once("moveend", () => {
          const barangayFeatures =
            mapRef.current?.queryRenderedFeatures(
              mapRef.current.project([lng, lat]),
              { layers: ["barangayBounds"] },
            ) ?? [];
          const name =
            barangayFeatures[0]?.properties?.name || "Unknown Barangay";
          handleSelection(geoFeature, { lng, lat }, name);
        });
      }
    },
    [handleSelection],
  );

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center,
      zoom,
    });

    mapRef.current = map;

    const handleStyleLoad = () => {
      addBarangayBounds(map);
      addHazardLayers(map, layerColors);
      syncLayerStyles(map, layerVisibility, layerColors, layerSpecificSelected);
      applyOverlayClipping(map);
      if (onMapReady) onMapReady(map, removeMarker);
    };

    map.on("style.load", handleStyleLoad);

    map.on("click", (e) => {
      const featuresAtPoint = map.queryRenderedFeatures(e.point);
      if (selectionMode === "poi") {
        const poiFeature = featuresAtPoint.find(
          (f) => f.layer?.id === "poi-label",
        );
        if (poiFeature) {
          const brgyFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["barangayBounds"],
          });
          const brgyName =
            brgyFeatures[0]?.properties?.name || "Unknown Barangay";
          handleSelection(poiFeature, e.lngLat, brgyName);
        }
      } else if (selectionMode === "barangay") {
        const brgyFeature = featuresAtPoint.find(
          (f) => f.layer?.id === "barangayBounds",
        );
        if (brgyFeature) {
          const name = brgyFeature.properties?.name;
          handleSelection(brgyFeature, e.lngLat, name);
          if (onBarangaySelected) onBarangaySelected(name);
          map.setPaintProperty("barangayBounds", "fill-color", [
            "match",
            ["get", "name"],
            name,
            "#FFD700",
            "#00FF00",
          ]);
        }
      }
    });

    map.on("mousemove", (e) => {
      if (selectionMode === "barangay") {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["barangayBounds"],
        });
        map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
      }
    });

    map.on("click", "aqiFillLayer", (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      new mapboxgl.Popup({ closeButton: true, maxWidth: "260px" })
        .setLngLat(e.lngLat)
        .setHTML(createAQIPopup(feat.properties))
        .addTo(map);
    });

    map.on("click", "lstFillLayer", (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      new mapboxgl.Popup({ closeButton: true, maxWidth: "240px" })
        .setLngLat(e.lngLat)
        .setHTML(createLSTPopup(feat.properties))
        .addTo(map);
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [selectionMode, center, zoom]);

  useEffect(() => {
    let cancelled = false;

    async function loadBarangayMask() {
      try {
        const response = await fetch("/geo/mandaue_barangay_boundaries.json");
        if (!response.ok) return;
        const data = await response.json();
        const features = (data?.features ?? []) as any[];
        const polygons: number[][][][] = [];

        features.forEach((f) => {
          if (!f.geometry) return;
          if (f.geometry.type === "Polygon")
            polygons.push(f.geometry.coordinates);
          else if (f.geometry.type === "MultiPolygon")
            f.geometry.coordinates.forEach((poly: any) => polygons.push(poly));
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
  }, []);

  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      syncLayerStyles(
        mapRef.current,
        layerVisibility,
        layerColors,
        layerSpecificSelected,
      );
    }
  }, [layerVisibility, layerColors, layerSpecificSelected]);

  useEffect(() => {
    if (mapRef.current && currentStyleRef.current !== styleUrl) {
      currentStyleRef.current = styleUrl;
      mapRef.current.setStyle(styleUrl);
    }
  }, [styleUrl]);

  useEffect(() => {
    if (!mapContainer.current || !mapRef.current) return;
    const resizeObserver = new ResizeObserver(() => mapRef.current?.resize());
    resizeObserver.observe(mapContainer.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="relative w-full h-full bg-neutral-100">
      <div ref={mapContainer} className={className} />
      <div className={`absolute ${searchBoxLocation}`}>
        <MapSearchBar
          accessToken={mapboxgl.accessToken || ""}
          map={mapRef.current}
          onRetrieve={handleSearchRetrieve}
        />
      </div>
    </div>
  );
}
