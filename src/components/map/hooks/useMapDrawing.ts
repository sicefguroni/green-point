"use client";

import { useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { type LocationSelectionMode } from "@/types/maplayers";
import type { SelectionHandler } from "./useMapSelection";
import {
  buildCustomSelectionPolygon,
  createDraftLassoFeatureCollection,
  createSelectedAreaFeatureCollection,
  getCustomSelectionAreaHectares,
  getCustomSelectionCentroid,
  type LassoPoint,
} from "@/lib/map/custom_selection";

const CUSTOM_SELECTED_SOURCE_ID = "custom-selected-area-source";
const CUSTOM_DRAFT_SOURCE_ID = "custom-draft-area-source";
const CUSTOM_SELECTED_FILL_LAYER_ID = "custom-selected-area-fill";
const CUSTOM_SELECTED_LINE_LAYER_ID = "custom-selected-area-line";
const CUSTOM_DRAFT_LINE_LAYER_ID = "custom-draft-area-line";
const CUSTOM_SELECTION_MIN_DISTANCE = 6;

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

export interface MapDrawingRefs {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  selectionModeRef: React.MutableRefObject<LocationSelectionMode>;
  onBarangaySelectedRef: React.MutableRefObject<
    ((barangayName: string) => void) | undefined
  >;
  handleSelectionRef: React.MutableRefObject<SelectionHandler | null>;
}

export function useMapDrawing(refs: MapDrawingRefs) {
  const { selectionModeRef, onBarangaySelectedRef, handleSelectionRef } = refs;

  const customDrawingPointsRef = useRef<LassoPoint[]>([]);
  const customDrawingScreenPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const customDrawingActiveRef = useRef(false);
  const customDrawingPointerIdRef = useRef<number | null>(null);
  const customPanActiveRef = useRef(false);
  const customPanPointerIdRef = useRef<number | null>(null);
  const customPanLastPointRef = useRef<{ x: number; y: number } | null>(null);

  // --- Overlay helpers ---

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
        paint: { "fill-color": "#16a34a", "fill-opacity": 0.22 },
      });
    }
    if (!map.getLayer(CUSTOM_SELECTED_LINE_LAYER_ID)) {
      map.addLayer({
        id: CUSTOM_SELECTED_LINE_LAYER_ID,
        type: "line",
        source: CUSTOM_SELECTED_SOURCE_ID,
        filter: ["==", ["get", "kind"], "selected-line"],
        layout: { "line-cap": "round", "line-join": "round" },
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
        layout: { "line-cap": "round", "line-join": "round" },
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

  /** Clean up any in-progress drawing/panning state. Called by the orchestrator
   * when selectionMode changes (where it has access to the actual prop value). */
  const resetDrawingState = useCallback((map: mapboxgl.Map | null) => {
    if (!map) return;

    if (customPanPointerIdRef.current !== null) {
      try { map.getCanvasContainer().releasePointerCapture(customPanPointerIdRef.current); } catch { /* ignore */ }
    }
    customPanPointerIdRef.current = null;
    customPanLastPointRef.current = null;
    customPanActiveRef.current = false;

    if (customDrawingPointerIdRef.current !== null) {
      try { map.getCanvasContainer().releasePointerCapture(customDrawingPointerIdRef.current); } catch { /* ignore */ }
    }
    customDrawingPointerIdRef.current = null;
    customDrawingActiveRef.current = false;
    customDrawingPointsRef.current = [];
    customDrawingScreenPointsRef.current = [];

    clearDraftCustomAreaOverlay(map);
    map.dragPan.enable();
    map.getCanvas().style.cursor = '';
  }, [clearDraftCustomAreaOverlay]);

  // --- Attach pointer event handlers for lasso drawing ---
  const attachDrawingHandlers = useCallback(
    (map: mapboxgl.Map) => {
      const canvasContainer = map.getCanvasContainer();

      const handlePointerDown = (event: PointerEvent) => {
        if (event.button === 1) {
          event.preventDefault();
          customPanActiveRef.current = true;
          customPanPointerIdRef.current = event.pointerId;
          customPanLastPointRef.current = { x: event.clientX, y: event.clientY };
          map.getCanvas().style.cursor = "grabbing";
          try { canvasContainer.setPointerCapture(event.pointerId); } catch {}
          return;
        }

        if (selectionModeRef.current !== "custom") return;
        if (event.button !== 0) return;

        event.preventDefault();
        customDrawingActiveRef.current = true;
        customDrawingPointsRef.current = [];
        customDrawingScreenPointsRef.current = [];

        const start = pointerEventToLngLat(map, event);
        customDrawingPointsRef.current.push([start.lng, start.lat]);
        customDrawingScreenPointsRef.current.push({ x: event.clientX, y: event.clientY });
        customDrawingPointerIdRef.current = event.pointerId;

        ensureCustomSelectionLayers(map);
        syncDraftCustomAreaOverlay(map, customDrawingPointsRef.current);
        map.dragPan.disable();
        map.getCanvas().style.cursor = "crosshair";

        try { canvasContainer.setPointerCapture(event.pointerId); } catch {}
      };

      const handlePointerMove = (event: PointerEvent) => {
        if (
          customPanActiveRef.current &&
          customPanPointerIdRef.current === event.pointerId
        ) {
          event.preventDefault();
          const currentPoint = { x: event.clientX, y: event.clientY };
          const lastPoint = customPanLastPointRef.current;
          if (lastPoint) {
            map.panBy(
              [lastPoint.x - currentPoint.x, lastPoint.y - currentPoint.y],
              { animate: false },
            );
          }
          customPanLastPointRef.current = currentPoint;
          map.getCanvas().style.cursor = "grabbing";
          return;
        }

        if (selectionModeRef.current !== "custom") return;
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
        if (selectionModeRef.current !== "custom" || !customDrawingActiveRef.current)
          return;

        customDrawingActiveRef.current = false;
        if (event) {
          try { canvasContainer.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
        }

        const points = customDrawingPointsRef.current;
        customDrawingPointsRef.current = [];
        customDrawingScreenPointsRef.current = [];

        const polygon = buildCustomSelectionPolygon(points);
        clearDraftCustomAreaOverlay(map);

        if (!polygon) {
          map.dragPan.enable();
          map.getCanvas().style.cursor = "crosshair";
          return;
        }

        const customAreaHectares = getCustomSelectionAreaHectares(polygon);
        const centroid = getCustomSelectionCentroid(polygon);
        const barangayFeatures = map.getLayer("barangayBounds")
          ? map.queryRenderedFeatures(map.project([centroid.lng, centroid.lat]), {
              layers: ["barangayBounds"],
            })
          : [];
        const barangay =
          (barangayFeatures[0]?.properties?.name as string | undefined) || "";

        syncSelectedCustomAreaOverlay(map, polygon);
        if (barangay && onBarangaySelectedRef.current) {
          onBarangaySelectedRef.current(barangay);
        }

        const customFeature = {
          type: "Feature",
          properties: { name: "Custom Area" },
          geometry: { type: "Point", coordinates: [centroid.lng, centroid.lat] },
        } as unknown as mapboxgl.GeoJSONFeature;

        if (handleSelectionRef.current) {
          handleSelectionRef.current(
            customFeature,
            centroid,
            barangay,
            "custom",
            polygon,
            customAreaHectares,
            false,
          );
        }

        map.dragPan.enable();
        map.getCanvas().style.cursor = "crosshair";
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (
          customPanActiveRef.current &&
          customPanPointerIdRef.current === event.pointerId
        ) {
          event.preventDefault();
          customPanActiveRef.current = false;
          customPanPointerIdRef.current = null;
          customPanLastPointRef.current = null;
          try { canvasContainer.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
          map.getCanvas().style.cursor = "crosshair";
          return;
        }
        if (selectionModeRef.current !== "custom") return;
        void completeCustomSelection(event);
      };

      const handlePointerCancel = () => {
        if (customPanPointerIdRef.current !== null) {
          try { canvasContainer.releasePointerCapture(customPanPointerIdRef.current); } catch { /* ignore */ }
        }
        if (customDrawingPointerIdRef.current !== null) {
          try { canvasContainer.releasePointerCapture(customDrawingPointerIdRef.current); } catch { /* ignore */ }
        }
        customDrawingPointerIdRef.current = null;
        customPanPointerIdRef.current = null;
        customPanLastPointRef.current = null;
        customDrawingActiveRef.current = false;
        customPanActiveRef.current = false;

        if (selectionModeRef.current !== "custom") return;
        customDrawingPointsRef.current = [];
        customDrawingScreenPointsRef.current = [];
        clearDraftCustomAreaOverlay(map);
        map.dragPan.enable();
        map.getCanvas().style.cursor = "crosshair";
      };

      canvasContainer.addEventListener("pointerdown", handlePointerDown);
      canvasContainer.addEventListener("pointermove", handlePointerMove);
      canvasContainer.addEventListener("pointerup", handlePointerUp);
      canvasContainer.addEventListener("pointercancel", handlePointerCancel);

      return () => {
        canvasContainer.removeEventListener("pointerdown", handlePointerDown);
        canvasContainer.removeEventListener("pointermove", handlePointerMove);
        canvasContainer.removeEventListener("pointerup", handlePointerUp);
        canvasContainer.removeEventListener("pointercancel", handlePointerCancel);
      };
    },
    [
      selectionModeRef,
      onBarangaySelectedRef,
      handleSelectionRef,
      ensureCustomSelectionLayers,
      syncDraftCustomAreaOverlay,
      syncSelectedCustomAreaOverlay,
      clearDraftCustomAreaOverlay,
    ],
  );

  return {
    ensureCustomSelectionLayers,
    syncSelectedCustomAreaOverlay,
    syncDraftCustomAreaOverlay,
    clearDraftCustomAreaOverlay,
    attachDrawingHandlers,
    resetDrawingState,
  };
}
