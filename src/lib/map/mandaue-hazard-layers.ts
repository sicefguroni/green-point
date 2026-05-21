import type mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import {
  LANDSLIDE_FILL_COLORS,
  MANDAUE_RASTER_HAZARD_CONFIGS,
  MANDAUE_VECTOR_HAZARD_CONFIGS,
  type MandaueRasterHazardGroupId,
  type MandaueVectorHazardGroupId,
} from "@/lib/map/mandaue-hazard-config";

type OverlayManifest = {
  overlays: {
    id: string;
    url: string;
    coordinates: [number, number][];
  }[];
};

const manifestCache = new Map<string, OverlayManifest>();

async function loadOverlayManifest(url: string): Promise<OverlayManifest> {
  const cached = manifestCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load overlay manifest: ${url}`);
  const data = (await res.json()) as OverlayManifest;
  manifestCache.set(url, data);
  return data;
}

export function getMandaueRasterLayerIds(groupId: MandaueRasterHazardGroupId): string[] {
  const config = MANDAUE_RASTER_HAZARD_CONFIGS.find((c) => c.groupId === groupId);
  if (!config) return [];
  const manifest = manifestCache.get(config.manifestUrl);
  if (!manifest) return [];
  return manifest.overlays.map((o) => `${config.layerIdPrefix}_${o.id}`);
}

export async function addMandaueHazardLayers(
  map: mapboxgl.Map,
  onReady?: () => void,
) {
  if (!map.getStyle()) return;

  for (const config of MANDAUE_VECTOR_HAZARD_CONFIGS) {
    if (!map.getSource(config.sourceId)) {
      map.addSource(config.sourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      fetch(config.geojsonUrl)
        .then((r) => r.json())
        .then((data) => {
          if (!map.getStyle()) return;
          const src = map.getSource(config.sourceId) as mapboxgl.GeoJSONSource;
          if (src) src.setData(data as GeoJSON.FeatureCollection);
        })
        .catch((err) =>
          console.error(`Failed to load ${config.groupId} geojson:`, err),
        );
    }

    if (!map.getLayer(config.layerId)) {
      map.addLayer({
        id: config.layerId,
        type: "fill",
        source: config.sourceId,
        layout: { visibility: "none" },
        paint: {
          "fill-color": "#E7B416",
          "fill-opacity": 0.55,
        },
      });
    }
  }

  await Promise.all(
    MANDAUE_RASTER_HAZARD_CONFIGS.map(async (config) => {
      try {
        const manifest = await loadOverlayManifest(config.manifestUrl);
        for (const overlay of manifest.overlays) {
          const sourceId = `${config.sourceIdPrefix}_${overlay.id}`;
          const layerId = `${config.layerIdPrefix}_${overlay.id}`;
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: "image",
              url: overlay.url,
              coordinates: overlay.coordinates as [
                [number, number],
                [number, number],
                [number, number],
                [number, number],
              ],
            });
          }
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: "raster",
              source: sourceId,
              layout: { visibility: "none" },
              paint: { "raster-opacity": 0.65, "raster-fade-duration": 0 },
            });
          }
        }
      } catch (err) {
        console.error(`Failed to load ${config.groupId} overlays:`, err);
      }
    }),
  );

  onReady?.();
}

export function syncMandaueVectorHazardStyles(
  map: mapboxgl.Map,
  groupId: MandaueVectorHazardGroupId,
  visible: boolean,
  opacity: number,
) {
  const config = MANDAUE_VECTOR_HAZARD_CONFIGS.find((c) => c.groupId === groupId);
  if (!config || !map.getLayer(config.layerId)) return;

  const colors = LANDSLIDE_FILL_COLORS;

  map.setLayoutProperty(config.layerId, "visibility", visible ? "visible" : "none");
  map.setPaintProperty(config.layerId, "fill-opacity", visible ? opacity : 0);
  map.setPaintProperty(config.layerId, "fill-color", [
    "match",
    ["get", config.colorField],
    1,
    colors[0],
    2,
    colors[1],
    3,
    colors[2],
    colors[0],
  ]);
}

export function syncMandaueRasterHazardStyles(
  map: mapboxgl.Map,
  groupId: MandaueRasterHazardGroupId,
  visible: boolean,
  opacity: number,
) {
  const config = MANDAUE_RASTER_HAZARD_CONFIGS.find((c) => c.groupId === groupId);
  if (!config) return;

  const manifest = manifestCache.get(config.manifestUrl);
  if (!manifest) return;

  for (const overlay of manifest.overlays) {
    const layerId = `${config.layerIdPrefix}_${overlay.id}`;
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    map.setPaintProperty(layerId, "raster-opacity", visible ? opacity : 0);
  }
}

export function getMandaueHazardLayerMapping(): Record<string, string[]> {
  const mapping: Record<string, string[]> = {};

  for (const config of MANDAUE_VECTOR_HAZARD_CONFIGS) {
    mapping[config.groupId] = [config.layerId];
  }

  for (const config of MANDAUE_RASTER_HAZARD_CONFIGS) {
    const manifest = manifestCache.get(config.manifestUrl);
    mapping[config.groupId] = manifest
      ? manifest.overlays.map((o) => `${config.layerIdPrefix}_${o.id}`)
      : [];
  }

  return mapping;
}

/** Preload manifests so layer order / sync can resolve raster layer ids. */
export async function preloadMandaueHazardManifests(): Promise<void> {
  await Promise.all(
    MANDAUE_RASTER_HAZARD_CONFIGS.map((c) => loadOverlayManifest(c.manifestUrl)),
  );
}

if (typeof window !== "undefined") {
  void preloadMandaueHazardManifests();
}

export function isPointInMandaueRasterHazard(
  lngLat: { lng: number; lat: number },
  groupId: MandaueRasterHazardGroupId,
): boolean {
  const config = MANDAUE_RASTER_HAZARD_CONFIGS.find((c) => c.groupId === groupId);
  if (!config) return false;
  const manifest = manifestCache.get(config.manifestUrl);
  if (!manifest) return false;

  const point = turf.point([lngLat.lng, lngLat.lat]);
  return manifest.overlays.some((overlay) => {
    const ring = [...overlay.coordinates, overlay.coordinates[0]] as [
      number,
      number,
    ][];
    return turf.booleanPointInPolygon(point, turf.polygon([ring]));
  });
}
