"use client";

import { useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { type LocationSelectionMode } from "@/types/maplayers";
import { toast } from "sonner";
import { createTreePopup } from "@/lib/map/popups";
import { resolveBarangayAt, screenDistanceSq } from "@/lib/map/point-selection";

const BARANGAY_BOUNDS_SOURCE_ID = "barangayBoundsSource";
const BARANGAY_BOUNDS_SOURCE_LAYER = "mandaue_barangay_boundaries-7byvux";

/** How far (px) from a POI's anchor a click still counts as clicking that POI. */
const POI_HIT_RADIUS_PX = 14;

type QueriedFeature = mapboxgl.GeoJSONFeature;

/**
 * The named POI under or right next to the click, if any.
 *
 * The app's custom styles import Mapbox Standard, so the POI icons people see
 * belong to the imported basemap and are only queryable through its `poi`
 * featureset. The styles' own `poi-label` layer is an invisible 5 px circle on
 * each POI's anchor, which a click on the icon or label usually misses, so it
 * is queried with a tolerance box. Classic styles (Dark) have a real
 * `poi-label` symbol layer, which the same box query covers.
 */
function findPoiNear(
  map: mapboxgl.Map,
  point: mapboxgl.Point,
): QueriedFeature | null {
  const candidates: QueriedFeature[] = [];

  try {
    const basemapPois = map.queryRenderedFeatures(point, {
      target: { featuresetId: "poi", importId: "basemap" },
    }) as unknown as QueriedFeature[];
    candidates.push(...basemapPois);
  } catch {
    // Style has no Standard basemap import (e.g. dark-v11).
  }

  if (map.getLayer("poi-label")) {
    const box: [mapboxgl.PointLike, mapboxgl.PointLike] = [
      [point.x - POI_HIT_RADIUS_PX, point.y - POI_HIT_RADIUS_PX],
      [point.x + POI_HIT_RADIUS_PX, point.y + POI_HIT_RADIUS_PX],
    ];
    candidates.push(...map.queryRenderedFeatures(box, { layers: ["poi-label"] }));
  }

  let best: QueriedFeature | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const name = candidate.properties?.name;
    if (typeof name !== "string" || !name.trim()) continue;
    const distance =
      candidate.geometry?.type === "Point"
        ? screenDistanceSq(
            map.project(candidate.geometry.coordinates as [number, number]),
            point,
          )
        : 0;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** A bare point feature for a pin dropped where there is no POI. */
function droppedPinFeature(lngLat: mapboxgl.LngLat): QueriedFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lngLat.lng, lngLat.lat] },
    properties: {},
  } as unknown as QueriedFeature;
}

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
  /** Bumped on every pin click so a slow barangay lookup can't win over a newer click. */
  const pinClickSeqRef = useRef(0);

  // Attach click / hover handlers in the map init effect
  const attachEventHandlers = useCallback(
    (map: mapboxgl.Map) => {
      /**
       * Pin mode: any click inside Mandaue drops a pin there. A POI under the
       * cursor only supplies the pin's name.
       */
      const selectPinAt = async (point: mapboxgl.Point, lngLat: mapboxgl.LngLat) => {
        const seq = ++pinClickSeqRef.current;
        const poiFeature = findPoiNear(map, point);

        // The rendered barangay layer is only queryable while it is visible,
        // so fall back to the boundary polygons.
        const renderedBarangay = map.getLayer("barangayBounds")
          ? (map.queryRenderedFeatures(point, { layers: ["barangayBounds"] })[0]
              ?.properties?.name as string | undefined)
          : undefined;

        let barangay = renderedBarangay;
        if (!barangay) {
          const lookup = await resolveBarangayAt(lngLat.lng, lngLat.lat);
          if (seq !== pinClickSeqRef.current || selectionModeRef.current !== "poi") return;
          if (lookup.status === "outside") {
            toast.info("That spot is outside Mandaue City. Pick a point inside one of its barangays.");
            return;
          }
          barangay = lookup.status === "inside" ? lookup.name : "Unknown Barangay";
        }

        handleSelectionRef.current?.(
          poiFeature ?? droppedPinFeature(lngLat),
          { lng: lngLat.lng, lat: lngLat.lat },
          barangay,
        );
      };

      const handleClick = (e: mapboxgl.MapMouseEvent) => {
        const currentMode = selectionModeRef.current;
        if (currentMode === "custom") return;

        const featuresAtPoint = map.getLayer("barangayBounds")
          ? map.queryRenderedFeatures(e.point)
          : [];

        if (currentMode === "poi") {
          void selectPinAt(e.point, e.lngLat);
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
          // Pin mode: a crosshair everywhere says "click anywhere to drop a pin".
          const idleCursor = selectionModeRef.current === "poi" ? "crosshair" : "";
          map.getCanvas().style.cursor = treeFeatures.length > 0 ? "pointer" : idleCursor;
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
    async (feature: {
      geometry: { type: string; coordinates: number[] };
      properties: Record<string, unknown>;
    }) => {
      if (!mapRef.current || feature.geometry.type !== "Point") return;
      const [lng, lat] = feature.geometry.coordinates;
      const geoFeature = feature as unknown as mapboxgl.GeoJSONFeature;

      // Search covers a box around the city, so a result can still sit just
      // outside it. Say so instead of flying away to a place we have no data for.
      const lookup = await resolveBarangayAt(lng, lat);
      if (lookup.status === "outside") {
        const placeName =
          typeof feature.properties?.name === "string" ? feature.properties.name : "That place";
        toast.info(
          `${placeName} is outside Mandaue City. GreenPoint only covers Mandaue's barangays.`,
        );
        return;
      }

      const map = mapRef.current;
      if (!map) return;
      map.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
      map.once("moveend", () => {
        const barangay =
          lookup.status === "inside" ? lookup.name : "Unknown Barangay";
        handleSelectionRef.current?.(geoFeature, { lng, lat }, barangay, "poi");
      });
    },
    [mapRef, handleSelectionRef],
  );

  return { attachEventHandlers, handleSearchRetrieve };
}
