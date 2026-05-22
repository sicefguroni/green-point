"use client";

import { useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { type LocationSelectionMode } from "@/types/maplayers";
import { createTreePopup } from "@/lib/map/popups";

const BARANGAY_BOUNDS_SOURCE_ID = "barangayBoundsSource";
const BARANGAY_BOUNDS_SOURCE_LAYER = "mandaue_barangay_boundaries-7byvux";

export type SelectionHandler = (
  feature: mapboxgl.GeoJSONFeature,
  coords: { lng: number; lat: number },
  barangay: string,
  mode?: LocationSelectionMode,
  customSelectionGeometry?: GeoJSON.Polygon | null,
  customSelectionAreaHectares?: number | null,
  placeMarker?: boolean,
) => void;

export interface MapSelectionRefs {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  selectionModeRef: React.MutableRefObject<LocationSelectionMode>;
  onBarangaySelectedRef: React.MutableRefObject<
    ((barangayName: string) => void) | undefined
  >;
  handleSelectionRef: React.MutableRefObject<SelectionHandler | null>;
  selectedBarangayIdRef: React.MutableRefObject<string | number | undefined>;
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

export function useMapSelection(refs: MapSelectionRefs) {
  const { mapRef, selectionModeRef, onBarangaySelectedRef, handleSelectionRef, selectedBarangayIdRef } = refs;
  const hoveredBarangayIdRef = useRef<string | number | undefined>(undefined);

  // Attach click / hover handlers in the map init effect
  const attachEventHandlers = useCallback(
    (map: mapboxgl.Map) => {
      const handleClick = (e: mapboxgl.MapMouseEvent) => {
        const currentMode = selectionModeRef.current;
        if (currentMode === "custom") return;

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
              newHoveredId !== hoveredBarangayIdRef.current
            ) {
              if (hoveredBarangayIdRef.current !== undefined) {
                map.setFeatureState(
                  getBarangayFeatureStateTarget(hoveredBarangayIdRef.current),
                  { hover: false },
                );
              }
              hoveredBarangayIdRef.current = newHoveredId;
              map.setFeatureState(features[0], { hover: true });
            }
          } else if (hoveredBarangayIdRef.current !== undefined) {
            map.setFeatureState(
              getBarangayFeatureStateTarget(hoveredBarangayIdRef.current),
              { hover: false },
            );
            hoveredBarangayIdRef.current = undefined;
          }
        } else {
          map.getCanvas().style.cursor = treeFeatures.length > 0 ? "pointer" : "";
          if (hoveredBarangayIdRef.current !== undefined) {
            map.setFeatureState(
              getBarangayFeatureStateTarget(hoveredBarangayIdRef.current),
              { hover: false },
            );
            hoveredBarangayIdRef.current = undefined;
          }
        }
      };

      const handleMouseLeave = () => {
        if (hoveredBarangayIdRef.current !== undefined) {
          map.setFeatureState(
            getBarangayFeatureStateTarget(hoveredBarangayIdRef.current),
            { hover: false },
          );
          hoveredBarangayIdRef.current = undefined;
        }
      };

      map.on("click", handleClick);
      map.on("mousemove", handleMouseMove);
      map.on("mouseleave", "barangayBounds", handleMouseLeave);

      return () => {
        map.off("click", handleClick);
        map.off("mousemove", handleMouseMove);
        map.off("mouseleave", "barangayBounds", handleMouseLeave);
      };
    },
    [
      selectionModeRef,
      onBarangaySelectedRef,
      handleSelectionRef,
      selectedBarangayIdRef,
    ],
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
            (barangayFeatures[0]?.properties?.name as string | undefined) ||
            "Unknown Barangay";
          if (handleSelectionRef.current) {
            handleSelectionRef.current(geoFeature, { lng, lat }, name, "poi");
          }
        });
      }
    },
    [mapRef, handleSelectionRef],
  );

  return { attachEventHandlers, handleSearchRetrieve };
}
