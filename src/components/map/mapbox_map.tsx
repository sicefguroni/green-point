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
  reorderLayers,
} from "@/lib/map/layer_manager";
import { createTreePopup } from "@/lib/map/popups";

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
const BARANGAY_BOUNDS_SOURCE_ID = "barangayBoundsSource";
const BARANGAY_BOUNDS_SOURCE_LAYER = "mandaue_barangay_boundaries-7byvux";

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
  hazardLayerOrder: string[];
  environmentalLayerOrder: string[];
  layerOpacity: Record<string, number>;
}

type SelectionHandler = (
  feature: mapboxgl.GeoJSONFeature,
  coords: { lng: number; lat: number },
  barangay: string,
) => void;

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

function getBarangayFeatureStateTarget(
  id: string | number,
): Parameters<mapboxgl.Map["setFeatureState"]>[0] {
  return {
    source: BARANGAY_BOUNDS_SOURCE_ID,
    sourceLayer: BARANGAY_BOUNDS_SOURCE_LAYER,
    id,
  };
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
  hazardLayerOrder,
  environmentalLayerOrder,
  layerOpacity,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const currentStyleRef = useRef(styleUrl);
  const barangayMaskRef = useRef<GeoJSON.MultiPolygon | null>(null);
  const selectedCustomAreaRef = useRef<GeoJSON.Polygon | null>(
    selectedCustomArea,
  );
  const customDrawingPointsRef = useRef<LassoPoint[]>([]);
  const customDrawingScreenPointsRef = useRef<Array<{ x: number; y: number }>>(
    [],
  );
  const customDrawingActiveRef = useRef(false);
  const customDrawingPointerIdRef = useRef<number | null>(null);
  const customPanActiveRef = useRef(false);
  const customPanPointerIdRef = useRef<number | null>(null);
  const customPanLastPointRef = useRef<{ x: number; y: number } | null>(null);
  const selectionModeRef = useRef(selectionMode);
  const onBarangaySelectedRef = useRef(onBarangaySelected);
  const onMapReadyRef = useRef(onMapReady);
  const layerVisibilityRef = useRef(layerVisibility);
  const layerColorsRef = useRef(layerColors);
  const layerSpecificSelectedRef = useRef(layerSpecificSelected);
  const hazardLayerOrderRef = useRef(hazardLayerOrder);
  const environmentalLayerOrderRef = useRef(environmentalLayerOrder);
  const layerOpacityRef = useRef(layerOpacity);
  const handleSelectionRef = useRef<SelectionHandler | null>(null);

  const selectedBarangayIdRef = useRef<string | number | undefined>(undefined);
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
    setGeoJsonSourceData(
      map,
      CUSTOM_DRAFT_SOURCE_ID,
      getEmptyFeatureCollection(),
    );
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

    const map = mapRef.current;
    if (!map) return;

    if (customPanPointerIdRef.current !== null) {
      try {
        map.getCanvasContainer().releasePointerCapture(
          customPanPointerIdRef.current,
        );
      } catch {
        // Ignore release failures if the pointer is no longer captured.
      }
    }

    customPanPointerIdRef.current = null;
    customPanLastPointRef.current = null;
    customPanActiveRef.current = false;

    if (selectionMode !== "custom") {
      if (customDrawingPointerIdRef.current !== null) {
        try {
          map.getCanvasContainer().releasePointerCapture(
            customDrawingPointerIdRef.current,
          );
        } catch {
          // Ignore release failures if the pointer is no longer captured.
        }
      }

      customDrawingPointerIdRef.current = null;
      customDrawingActiveRef.current = false;
      customDrawingPointsRef.current = [];
      customDrawingScreenPointsRef.current = [];
      clearDraftCustomAreaOverlay(map);
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      return;
    }

    map.getCanvas().style.cursor = "crosshair";
  }, [selectionMode, clearDraftCustomAreaOverlay]);

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
    hazardLayerOrderRef.current = hazardLayerOrder;
  }, [hazardLayerOrder]);

  useEffect(() => {
    environmentalLayerOrderRef.current = environmentalLayerOrder;
  }, [environmentalLayerOrder]);

  useEffect(() => {
    layerOpacityRef.current = layerOpacity;
  }, [layerOpacity]);

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
  }, [
    ensureCustomSelectionLayers,
    selectedCustomArea,
    syncSelectedCustomAreaOverlay,
  ]);

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
      const syncCurrentLayerState = () => {
        syncLayerStyles(
          map,
          layerVisibilityRef.current,
          layerColorsRef.current,
          layerSpecificSelectedRef.current,
          selectionModeRef.current,
          layerOpacityRef.current,
        );
        applyOverlayClipping(map);
        reorderLayers(
          map,
          hazardLayerOrderRef.current,
          environmentalLayerOrderRef.current,
        );
      };

      addHazardLayers(map, layerColorsRef.current, syncCurrentLayerState);
      addBarangayBounds(map);
      syncCurrentLayerState();
      addTaggedTreesLayer(map);
      ensureCustomSelectionLayers(map);
      syncSelectedCustomAreaOverlay(map, selectedCustomAreaRef.current);
      syncDraftCustomAreaOverlay(map, customDrawingPointsRef.current);

      if (selectionModeRef.current === "custom") {
        map.getCanvas().style.cursor = "crosshair";
      } else {
        map.dragPan.enable();
      }

      if (onMapReadyRef.current) onMapReadyRef.current(map, removeMarker);
    };

    map.on("style.load", handleStyleLoad);

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const currentMode = selectionModeRef.current;
      if (currentMode === "custom") {
        return;
      }

      const featuresAtPoint = map.getLayer("barangayBounds")
        ? map.queryRenderedFeatures(e.point)
        : [];
      if (currentMode === "poi") {
        const poiFeature = featuresAtPoint.find(
          (f) => f.layer?.id === "poi-label",
        );
        if (poiFeature) {
          const brgyFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["barangayBounds"],
          });
          const brgyName =
            (brgyFeatures[0]?.properties?.name as string | undefined) ||
            "Unknown Barangay";
          if (handleSelectionRef.current) {
            handleSelectionRef.current(poiFeature, e.lngLat, brgyName);
          }
        }
      } else if (currentMode === "barangay") {
        const brgyFeature = featuresAtPoint.find(
          (f) => f.layer?.id === "barangayBounds",
        );
        if (brgyFeature) {
          const name = brgyFeature.properties?.name as string | undefined;
          if (handleSelectionRef.current) {
            handleSelectionRef.current(brgyFeature, e.lngLat, name || "");
          }
          if (onBarangaySelectedRef.current && name) {
            onBarangaySelectedRef.current(name);
          }

          const brgyId = brgyFeature.id ?? brgyFeature.properties?.name;
          if (brgyId !== undefined && brgyId !== null) {
            if (selectedBarangayIdRef.current !== undefined) {
              map.setFeatureState(
                getBarangayFeatureStateTarget(selectedBarangayIdRef.current),
                { selected: false },
              );
            }

            selectedBarangayIdRef.current = brgyId;
            map.setFeatureState(brgyFeature, { selected: true });
          }
        }
      }

      // --- Tree Click Handling ---
      const treeFeature = featuresAtPoint.find(
        (f) => f.layer?.id === "taggedTreesLayer",
      );
      if (treeFeature && treeFeature.geometry.type === "Point") {
        const coords = treeFeature.geometry.coordinates as [number, number];
        const props = treeFeature.properties;

        new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "300px",
          className: "tree-popup",
        })
          .setLngLat(coords)
          .setHTML(createTreePopup(props || {}))
          .addTo(map);
      }
    };

    map.on("click", handleClick);

    let hoveredBarangayId: string | number | undefined = undefined;

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const isBarangayMode = selectionModeRef.current === "barangay";

      const features = map.getLayer("barangayBounds")
        ? map.queryRenderedFeatures(e.point, {
            layers: ["barangayBounds"],
          })
        : [];

      const treeFeatures = map.getLayer("taggedTreesLayer")
        ? map.queryRenderedFeatures(e.point, {
            layers: ["taggedTreesLayer"],
          })
        : [];

      if (isBarangayMode) {
        map.getCanvas().style.cursor =
          features.length > 0 || treeFeatures.length > 0 ? "pointer" : "";

        if (features.length > 0) {
          const newHoveredId = features[0].id ?? features[0].properties?.name;
          if (
            newHoveredId !== undefined &&
            newHoveredId !== null &&
            newHoveredId !== hoveredBarangayId
          ) {
            if (hoveredBarangayId !== undefined) {
              map.setFeatureState(
                getBarangayFeatureStateTarget(hoveredBarangayId),
                { hover: false },
              );
            }
            hoveredBarangayId = newHoveredId;
            map.setFeatureState(features[0], { hover: true });
          }
        } else if (hoveredBarangayId !== undefined) {
          map.setFeatureState(
            getBarangayFeatureStateTarget(hoveredBarangayId),
            { hover: false },
          );
          hoveredBarangayId = undefined;
        }
      } else {
        map.getCanvas().style.cursor = treeFeatures.length > 0 ? "pointer" : "";
        if (hoveredBarangayId !== undefined) {
          map.setFeatureState(
            getBarangayFeatureStateTarget(hoveredBarangayId),
            { hover: false },
          );
          hoveredBarangayId = undefined;
        }
      }
    };

    const handleMouseLeave = () => {
      if (hoveredBarangayId !== undefined) {
        map.setFeatureState(
          getBarangayFeatureStateTarget(hoveredBarangayId),
          { hover: false },
        );
        hoveredBarangayId = undefined;
      }
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", "barangayBounds", handleMouseLeave);

    const canvasContainer = map.getCanvasContainer();

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 1) {
        event.preventDefault();
        customPanActiveRef.current = true;
        customPanPointerIdRef.current = event.pointerId;
        customPanLastPointRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        map.getCanvas().style.cursor = "grabbing";

        try {
          canvasContainer.setPointerCapture(event.pointerId);
        } catch {}

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
      customDrawingScreenPointsRef.current.push({
        x: event.clientX,
        y: event.clientY,
      });
      customDrawingPointerIdRef.current = event.pointerId;

      ensureCustomSelectionLayers(map);
      syncDraftCustomAreaOverlay(map, customDrawingPointsRef.current);
      map.dragPan.disable();
      map.getCanvas().style.cursor = "crosshair";

      try {
        canvasContainer.setPointerCapture(event.pointerId);
      } catch {}
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
      if (
        selectionModeRef.current !== "custom" ||
        !customDrawingActiveRef.current
      )
        return;

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
      } as unknown as mapboxgl.GeoJSONFeature;

      void handleSelection(
        customFeature,
        centroid,
        barangay,
        "custom",
        polygon,
        customAreaHectares,
        false,
      );

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

        try {
          canvasContainer.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore release failures when the pointer was not captured.
        }

        map.getCanvas().style.cursor = "crosshair";
        return;
      }

      if (selectionModeRef.current !== "custom") return;

      void completeCustomSelection(event);
    };

    const handlePointerCancel = () => {
      if (customPanPointerIdRef.current !== null) {
        try {
          canvasContainer.releasePointerCapture(customPanPointerIdRef.current);
        } catch {
          // Ignore release failures if the pointer is no longer captured.
        }
      }

      if (customDrawingPointerIdRef.current !== null) {
        try {
          canvasContainer.releasePointerCapture(
            customDrawingPointerIdRef.current,
          );
        } catch {
          // Ignore release failures if the pointer is no longer captured.
        }
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

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

    return () => {
      map.off("style.load", handleStyleLoad);
      map.off("click", handleClick);
      map.off("mousemove", handleMouseMove);
      map.off("mouseleave", "barangayBounds", handleMouseLeave);
      canvasContainer.removeEventListener("pointerdown", handlePointerDown);
      canvasContainer.removeEventListener("pointermove", handlePointerMove);
      canvasContainer.removeEventListener("pointerup", handlePointerUp);
      canvasContainer.removeEventListener("pointercancel", handlePointerCancel);
      map.remove();
      mapRef.current = null;
    };
  }, [
    removeMarker,
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
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const liveMap = mapRef.current;
      if (!liveMap) return;
      // `getStyle()` throws "Style is not done loading" on Mapbox GL ≥3
      // while the style is still hydrating. `isStyleLoaded()` is the safe
      // gate; the follow-up `style.load` / `idle` listeners below will
      // re-run this once the style is actually ready.
      if (!liveMap.isStyleLoaded()) return;
      try {
        if (!liveMap.getStyle()) return;
      } catch {
        return;
      }
      syncLayerStyles(
        liveMap,
        layerVisibilityRef.current,
        layerColorsRef.current,
        layerSpecificSelectedRef.current,
        selectionModeRef.current,
        layerOpacityRef.current,
      );
      reorderLayers(
        liveMap,
        hazardLayerOrderRef.current,
        environmentalLayerOrderRef.current,
      );
    };

    // Always try synchronously: internal guards no-op safely if style isn't
    // ready yet. Then queue a follow-up on the next style.load + idle so the
    // swap definitely paints once the style has rehydrated.
    apply();

    let cancelled = false;
    const reapply = () => {
      if (cancelled) return;
      apply();
    };

    map.once("style.load", reapply);
    map.once("idle", reapply);

    return () => {
      cancelled = true;
      map.off("style.load", reapply);
      map.off("idle", reapply);
    };
  }, [
    layerVisibility,
    layerColors,
    layerSpecificSelected,
    selectionMode,
    hazardLayerOrder,
    environmentalLayerOrder,
    layerOpacity,
  ]);

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

function addTaggedTreesLayer(map: mapboxgl.Map) {
  if (!map.getSource("taggedTreesSource")) {
    map.addSource("taggedTreesSource", {
      type: "geojson",
      data: "/api/trees",
    });
  }

  if (!map.getLayer("taggedTreesLayer")) {
    map.addLayer({
      id: "taggedTreesLayer",
      type: "circle",
      source: "taggedTreesSource",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          1.5,
          16,
          4,
          20,
          10,
        ],
        "circle-color": "#10b981",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    });
  }
}
