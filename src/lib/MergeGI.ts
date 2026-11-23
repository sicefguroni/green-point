/**
 * A row of `public/geo/mandaue_barangays_gi.geojson`. The file holds labels
 * only; its old GI/NDVI/LST/canopy numbers were placeholders and are removed.
 */
export type GreeneryIndexData = {
  name: string;
  flood_exposure?: string;
  current_intervention?: string;
};

/**
 * Merge static boundaries with live `/api/data?resource=greeneryIndex` features.
 * Optional `staticSupplement` (`mandaue_barangays_gi.geojson`) fills the flood
 * and intervention labels. Metrics come only from the live data: a barangay
 * with no live value gets null, never a number from the static file.
 */
export function mergeBoundariesWithLiveGreenery(
  boundaries: GeoJSON.FeatureCollection,
  liveGreenery: GeoJSON.FeatureCollection,
  staticSupplement: GreeneryIndexData[] = [],
): GeoJSON.FeatureCollection {
  const liveByName = new Map<string, Record<string, unknown>>();
  for (const f of liveGreenery.features) {
    const raw = f.properties?.name;
    const name = typeof raw === "string" ? raw.trim() : "";
    if (name)
      liveByName.set(name.toLowerCase(), (f.properties ?? {}) as Record<string, unknown>);
  }

  const findSup = (name: string) =>
    staticSupplement.find(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };

  return {
    type: "FeatureCollection",
    features: boundaries.features.map((feature) => {
      const name = String(feature.properties?.name ?? "").trim();
      const live = name ? liveByName.get(name.toLowerCase()) : undefined;
      const sup = name ? findSup(name) : undefined;

      const gIdx = num(live?.greeneryIndex);
      const ndvi = num(live?.ndvi);
      const lst = num(live?.lst);
      const treeCanopy = num(live?.treeCanopy);

      return {
        ...feature,
        properties: {
          ...feature.properties,
          greenery_index: gIdx,
          ndvi,
          lst,
          tree_canopy: treeCanopy,
          flood_exposure: sup?.flood_exposure ?? "—",
          current_intervention: sup?.current_intervention ?? "—",
        },
      };
    }),
  };
}

/**
 * Boundaries with only the static labels, used when live data is unavailable.
 * Metrics are null so nothing shows made-up numbers.
 */
export function mergeGI(
  geoJSON: GeoJSON.FeatureCollection,
  giJSON: GreeneryIndexData[],
) {
  return {
    ...geoJSON,
    features: geoJSON.features.map((feature) => {
      const name = feature.properties?.name;
      const match = giJSON.find((d) => d.name === name);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          greenery_index: null,
          ndvi: null,
          lst: null,
          tree_canopy: null,
          flood_exposure: match?.flood_exposure ?? null,
          current_intervention: match?.current_intervention ?? null,
        },
      };
    }),
  };
}
