import { area, centerOfMass, polygon as turfPolygon } from "@turf/turf";

export type LassoPoint = [number, number];

function toClosedRing(points: LassoPoint[]) {
  if (points.length < 3) {
    return null;
  }

  const ring: LassoPoint[] = points.map(([lng, lat]) => [lng, lat]);
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];

  if (firstLng !== lastLng || firstLat !== lastLat) {
    ring.push([firstLng, firstLat]);
  }

  return ring;
}

export function buildCustomSelectionPolygon(
  points: LassoPoint[],
): GeoJSON.Polygon | null {
  const ring = toClosedRing(points);
  if (!ring) {
    return null;
  }

  return turfPolygon([ring]).geometry;
}

export function getCustomSelectionAreaHectares(polygon: GeoJSON.Polygon) {
  return area(polygon) / 10000;
}

export function getCustomSelectionCentroid(polygon: GeoJSON.Polygon) {
  const center = centerOfMass(polygon);
  const [lng, lat] = center.geometry.coordinates;

  return { lng, lat };
}

export function createSelectedAreaFeatureCollection(
  polygon: GeoJSON.Polygon | null,
): GeoJSON.FeatureCollection {
  if (!polygon) {
    return { type: "FeatureCollection", features: [] };
  }

  const ring = polygon.coordinates[0] ?? [];

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "selected-fill" },
        geometry: polygon,
      },
      {
        type: "Feature",
        properties: { kind: "selected-line" },
        geometry: {
          type: "LineString",
          coordinates: ring,
        },
      },
    ],
  };
}

export function createDraftLassoFeatureCollection(
  points: LassoPoint[],
): GeoJSON.FeatureCollection {
  if (points.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "draft-line" },
        geometry: {
          type: "LineString",
          coordinates: points,
        },
      },
    ],
  };
}