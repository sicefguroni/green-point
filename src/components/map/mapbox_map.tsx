"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapSearchBar from "./map_search";
import { type LocationSelectionMode } from "@/types/maplayers";
import { type SelectedFeature } from "@/types/metrics";
import {
  addBarangayBounds,
  addHazardLayers,
  syncLayerStyles,
  applyOverlayClipping,
} from "@/lib/map/layer_manager";
import { handleFeatureSelection as processFeatureSelection } from "@/lib/map/feature_selection";
import {
  buildCustomSelectionPolygon,
  createDraftLassoFeatureCollection,
  createSelectedAreaFeatureCollection,
  getCustomSelectionAreaHectares,
  getCustomSelectionCentroid,
  type LassoPoint,
} from "@/lib/map/custom_selection";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

const DEFAULT_CENTER: [number, number] = [123.939, 10.351];
const DEFAULT_ZOOM = 12;

const CUSTOM_SELECTED_SOURCE_ID = "custom-selected-area-source";
const CUSTOM_DRAFT_SOURCE_ID = "custom-draft-area-source";
const CUSTOM_SELECTED_FILL_LAYER_ID = "custom-selected-area-fill";
const CUSTOM_SELECTED_LINE_LAYER_ID = "custom-selected-area-line";
const CUSTOM_DRAFT_LINE_LAYER_ID = "custom-draft-area-line";
const CUSTOM_SELECTION_MIN_DISTANCE = 6;

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  styleUrl: string;
  layerVisibility: Record<string, boolean>;
  layerColors: Record<string, string[]>;
  layerSpecificSelected: Record<string, string>;
  searchBoxLocation: string;
  selectedCustomArea?: GeoJSON.Polygon | null;
  onFeatureSelected?: (featureData: SelectedFeature) => void;
  onBarangaySelected?: (barangayName: string) => void;
  onMapReady?: (map: mapboxgl.Map, removeMarker: () => void) => void;
  selectionMode: LocationSelectionMode;
}

function getEmptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function setGeoJsonSourceData(
  map: mapboxgl.Map,
  sourceId: string,
  data: GeoJSON.FeatureCollection,
) {
  const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(data);
}

function pointerEventToLngLat(map: mapboxgl.Map, event: PointerEvent) {
  const container = map.getCanvasContainer();
  const rect = container.getBoundingClientRect();
  const lngLat = map.unproject([
    event.clientX - rect.left,
    event.clientY - rect.top,
  ]);

  return { lng: lngLat.lng, lat: lngLat.lat };
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
  selectedCustomArea = null,
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
  const selectedCustomAreaRef = useRef<GeoJSON.Polygon | null>(selectedCustomArea);
  const customDrawingPointsRef = useRef<LassoPoint[]>([]);
  const customDrawingScreenPointsRef = useRef<Array<{ x: number; y: number }>>(
    [],
  );
  const customDrawingActiveRef = useRef(false);
  const selectionModeRef = useRef(selectionMode);
  const onBarangaySelectedRef = useRef(onBarangaySelected);
  const onMapReadyRef = useRef(onMapReady);
  const layerVisibilityRef = useRef(layerVisibility);
  const layerColorsRef = useRef(layerColors);
  const layerSpecificSelectedRef = useRef(layerSpecificSelected);
  const handleSelectionRef = useRef<((feature: SelectedFeature, coords: any, barangay: any) => void) | null>(null);

  const removeMarker = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, []);

  const ensureCustomSelectionLayers = useCallback((map: mapboxgl.Map) => {
    if (!map.getSource(CUSTOM_SELECTED_SOURCE_ID)) {
      map.addSource(CUSTOM_SELECTED_SOURCE_ID, {
        type: "geojson",
        data: getEmptyFeatureCollection(),
      });
    }

    if (!map.getSource(CUSTOM_DRAFT_SOURCE_ID)) {
      map.addSource(CUSTOM_DRAFT_SOURCE_ID, {
        type: "geojson",
        data: getEmptyFeatureCollection(),
      });
    }

    if (!map.getLayer(CUSTOM_SELECTED_FILL_LAYER_ID)) {
      map.addLayer({
        id: CUSTOM_SELECTED_FILL_LAYER_ID,
        type: "fill",
        source: CUSTOM_SELECTED_SOURCE_ID,
        filter: ["==", ["get", "kind"], "selected-fill"],
        paint: {
          "fill-color": "#16a34a",
          "fill-opacity": 0.22,
        },
      });
    }

    if (!map.getLayer(CUSTOM_SELECTED_LINE_LAYER_ID)) {
      map.addLayer({
        id: CUSTOM_SELECTED_LINE_LAYER_ID,
        type: "line",
        source: CUSTOM_SELECTED_SOURCE_ID,
        filter: ["==", ["get", "kind"], "selected-line"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#166534",
          "line-width": 3,
          "line-opacity": 0.95,
        },
      });
    }

    if (!map.getLayer(CUSTOM_DRAFT_LINE_LAYER_ID)) {
      map.addLayer({
        id: CUSTOM_DRAFT_LINE_LAYER_ID,
        type: "line",
        source: CUSTOM_DRAFT_SOURCE_ID,
        filter: ["==", ["get", "kind"], "draft-line"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#10b981",
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.95,
        },
      });
    }
  }, []);

  const syncSelectedCustomAreaOverlay = useCallback(
    (map: mapboxgl.Map, polygon: GeoJSON.Polygon | null) => {
      setGeoJsonSourceData(
        map,
        CUSTOM_SELECTED_SOURCE_ID,
        createSelectedAreaFeatureCollection(polygon),
      );
    },
    [],
  );

  const syncDraftCustomAreaOverlay = useCallback(
    (map: mapboxgl.Map, points: LassoPoint[]) => {
      setGeoJsonSourceData(
        map,
        CUSTOM_DRAFT_SOURCE_ID,
        createDraftLassoFeatureCollection(points),
      );
    },
    [],
  );

  const clearDraftCustomAreaOverlay = useCallback((map: mapboxgl.Map) => {
    setGeoJsonSourceData(map, CUSTOM_DRAFT_SOURCE_ID, getEmptyFeatureCollection());
  }, []);

  const handleSelection = useCallback(
    async (
      feature: mapboxgl.GeoJSONFeature,
      coords: { lng: number; lat: number },
      barangay: string,
      mode: LocationSelectionMode = selectionMode,
      customSelectionGeometry: GeoJSON.Polygon | null = null,
      customSelectionAreaHectares: number | null = null,
      placeMarker = true,
    ) => {
      if (!mapRef.current) return;

      await processFeatureSelection(
        feature,
        coords,
        barangay,
        mapRef.current,
        markerRef,
        onFeatureSelected,
        mode,
        customSelectionGeometry,
        customSelectionAreaHectares,
        placeMarker,
      );
    },
    [onFeatureSelected, selectionMode],
  );

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    onBarangaySelectedRef.current = onBarangaySelected;
  }, [onBarangaySelected]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    layerVisibilityRef.current = layerVisibility;
  }, [layerVisibility]);

  useEffect(() => {
    layerColorsRef.current = layerColors;
  }, [layerColors]);

  useEffect(() => {
    layerSpecificSelectedRef.current = layerSpecificSelected;
  }, [layerSpecificSelected]);

  useEffect(() => {
    handleSelectionRef.current = (feature, coords, barangay) => {
      void handleSelection(feature, coords, barangay);
    };
  }, [handleSelection]);

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
            (barangayFeatures[0]?.properties?.name as string | undefined) ||
            "Unknown Barangay";
          void handleSelection(geoFeature, { lng, lat }, name, "poi");
        });
      }
    },
    [handleSelection],
  );

  useEffect(() => {
    selectedCustomAreaRef.current = selectedCustomArea;

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    ensureCustomSelectionLayers(map);
    syncSelectedCustomAreaOverlay(map, selectedCustomArea);
  }, [ensureCustomSelectionLayers, selectedCustomArea, syncSelectedCustomAreaOverlay]);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center,
      zoom,
    });

    mapRef.current = map;

    const handleStyleLoad = () => {
      addBarangayBounds(map);
      addHazardLayers(map, layerColorsRef.current);
      syncLayerStyles(
        map,
        layerVisibilityRef.current,
        layerColorsRef.current,
        layerSpecificSelectedRef.current,
        selectionModeRef.current,
      );
      applyOverlayClipping(map);
      ensureCustomSelectionLayers(map);
      syncSelectedCustomAreaOverlay(map, selectedCustomAreaRef.current);
      syncDraftCustomAreaOverlay(map, customDrawingPointsRef.current);

      if (selectionMode === "custom") {
        map.dragPan.disable();
        map.getCanvas().style.cursor = "crosshair";
      } else {
        map.dragPan.enable();
      }

      if (onMapReady) onMapReady(map, removeMarker);
    };

    map.on("style.load", handleStyleLoad);

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (selectionMode === "custom") {
        return;
      }

      const featuresAtPoint = map.queryRenderedFeatures(e.point);
      if (selectionMode === "poi") {
        const poiFeature = featuresAtPoint.find((f) => f.layer?.id === "poi-label");
        if (poiFeature) {
          const brgyFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["barangayBounds"],
          });
          const brgyName =
            (brgyFeatures[0]?.properties?.name as string | undefined) ||
            "Unknown Barangay";
          void handleSelection(poiFeature, e.lngLat, brgyName, "poi");
        }
      } else if (selectionModeRef.current === "barangay") {
        const brgyFeature = featuresAtPoint.find(
          (f) => f.layer?.id === "barangayBounds",
        );
        if (brgyFeature) {
          const name = brgyFeature.properties?.name as string | undefined;
          void handleSelection(brgyFeature, e.lngLat, name || "", "barangay");
          if (onBarangaySelected && name) onBarangaySelected(name);
          map.setPaintProperty("barangayBounds", "fill-color", [
            "match",
            ["get", "name"],
            name,
            "#FFD700",
            "#00FF00",
          ]);
        }
      }
    };

    map.on("click", handleClick);

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (selectionMode === "barangay") {
        if (!map.getLayer("barangayBounds")) return;

        const features = map.queryRenderedFeatures(e.point, {
          layers: ["barangayBounds"],
        });
        map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
      } else {
        map.getCanvas().style.cursor = "";
      }
    };

    map.on("mousemove", handleMouseMove);

    const canvasContainer = map.getCanvasContainer();

    const handlePointerDown = (event: PointerEvent) => {
      if (selectionMode !== "custom" || event.button !== 0) return;

      event.preventDefault();
      customDrawingActiveRef.current = true;
      customDrawingPointsRef.current = [];
      customDrawingScreenPointsRef.current = [];

      const start = pointerEventToLngLat(map, event);
      customDrawingPointsRef.current.push([start.lng, start.lat]);
      customDrawingScreenPointsRef.current.push({
        x: event.clientX,
        y: event.clientY,
      });

      ensureCustomSelectionLayers(map);
      syncDraftCustomAreaOverlay(map, customDrawingPointsRef.current);
      map.dragPan.disable();
      map.getCanvas().style.cursor = "crosshair";

      try {
        canvasContainer.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures on browsers that do not support it reliably.
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (selectionMode !== "custom") return;

      map.getCanvas().style.cursor = "crosshair";

      if (!customDrawingActiveRef.current) return;

      event.preventDefault();
      const currentScreenPoint = { x: event.clientX, y: event.clientY };
      const lastScreenPoint =
        customDrawingScreenPointsRef.current[
          customDrawingScreenPointsRef.current.length - 1
        ];

      if (
        lastScreenPoint &&
        Math.hypot(
          currentScreenPoint.x - lastScreenPoint.x,
          currentScreenPoint.y - lastScreenPoint.y,
        ) < CUSTOM_SELECTION_MIN_DISTANCE
      ) {
        return;
      }

      customDrawingScreenPointsRef.current.push(currentScreenPoint);
      const point = pointerEventToLngLat(map, event);
      customDrawingPointsRef.current.push([point.lng, point.lat]);
      syncDraftCustomAreaOverlay(map, customDrawingPointsRef.current);
    };

    const completeCustomSelection = async (event?: PointerEvent) => {
      if (selectionMode !== "custom" || !customDrawingActiveRef.current) return;

      customDrawingActiveRef.current = false;
      if (event) {
        try {
          canvasContainer.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore release failures when the pointer was not captured.
        }
      }

      const points = customDrawingPointsRef.current;
      customDrawingPointsRef.current = [];
      customDrawingScreenPointsRef.current = [];

      const polygon = buildCustomSelectionPolygon(points);
      clearDraftCustomAreaOverlay(map);

      if (!polygon) {
        map.getCanvas().style.cursor = "crosshair";
        return;
      }

      const customAreaHectares = getCustomSelectionAreaHectares(polygon);
      const centroid = getCustomSelectionCentroid(polygon);
      const barangayFeatures = map.queryRenderedFeatures(
        map.project([centroid.lng, centroid.lat]),
        { layers: ["barangayBounds"] },
      );
      const barangay =
        (barangayFeatures[0]?.properties?.name as string | undefined) || "";

      syncSelectedCustomAreaOverlay(map, polygon);
      if (barangay && onBarangaySelected) {
        onBarangaySelected(barangay);
      }

      const customFeature = {
        type: "Feature",
        properties: {
          name: "Custom Area",
        },
        geometry: {
          type: "Point",
          coordinates: [centroid.lng, centroid.lat],
        },
      } as mapboxgl.GeoJSONFeature;

      void handleSelection(
        customFeature,
        centroid,
        barangay,
        "custom",
        polygon,
        customAreaHectares,
        false,
      );

      map.getCanvas().style.cursor = "crosshair";
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (selectionMode !== "custom") return;

      void completeCustomSelection(event);
    };

    const handlePointerCancel = () => {
      if (selectionMode !== "custom") return;

      customDrawingActiveRef.current = false;
      customDrawingPointsRef.current = [];
      customDrawingScreenPointsRef.current = [];
      clearDraftCustomAreaOverlay(map);
      map.getCanvas().style.cursor = "crosshair";
    };

    canvasContainer.addEventListener("pointerdown", handlePointerDown);
    canvasContainer.addEventListener("pointermove", handlePointerMove);
    canvasContainer.addEventListener("pointerup", handlePointerUp);
    canvasContainer.addEventListener("pointercancel", handlePointerCancel);

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

    return () => {
      map.off("style.load", handleStyleLoad);
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
      canvasContainer.removeEventListener("pointerdown", handlePointerDown);
      canvasContainer.removeEventListener("pointermove", handlePointerMove);
      canvasContainer.removeEventListener("pointerup", handlePointerUp);
      canvasContainer.removeEventListener("pointercancel", handlePointerCancel);
      map.remove();
      mapRef.current = null;
    };
  }, [
    center,
    zoom,
    layerVisibility,
    layerColors,
    layerSpecificSelected,
    styleUrl,
    selectionMode,
    onMapReady,
    removeMarker,
    handleSelection,
    onBarangaySelected,
    ensureCustomSelectionLayers,
    syncSelectedCustomAreaOverlay,
    syncDraftCustomAreaOverlay,
    clearDraftCustomAreaOverlay,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadBarangayMask() {
      try {
        const response = await fetch("/geo/mandaue_barangay_boundaries.json");
        if (!response.ok) return;
        const data = (await response.json()) as FeatureCollection<Geometry>;
        const features = data.features ?? [];
        const polygons: number[][][][] = [];

        features.forEach((f) => {
          if (!f.geometry) return;
          if (f.geometry.type === "Polygon") {
            polygons.push(f.geometry.coordinates);
          } else if (f.geometry.type === "MultiPolygon") {
            f.geometry.coordinates.forEach((poly: any) => polygons.push(poly));
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
  }, []);

  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      syncLayerStyles(
        mapRef.current,
        layerVisibility,
        layerColors,
        layerSpecificSelected,
        selectionMode,
      );
      if (selectionMode === "custom") {
        mapRef.current.getCanvas().style.cursor = "crosshair";
        mapRef.current.dragPan.disable();
      } else {
        mapRef.current.dragPan.enable();
      }
    }
  }, [layerVisibility, layerColors, layerSpecificSelected, selectionMode]);

  useEffect(() => {
    if (mapRef.current && currentStyleRef.current !== styleUrl) {
      currentStyleRef.current = styleUrl;
      mapRef.current.setStyle(styleUrl);
    }
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.jumpTo({ center, zoom });
  }, [center, zoom]);

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