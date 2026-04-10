export type GreeneryIndexData = {
  name: string;
  greenery_index: number;
  ndvi: number;
  lst: number;
  tree_canopy: number;
  flood_exposure: string;
  current_intervention: string;
};

/**
 * Merge static boundaries with live `/api/data?resource=greeneryIndex` features.
 * Optional `staticSupplement` (e.g. `mandaue_barangays_gi.geojson`) fills flood/intervention labels.
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

      const gIdx = num(live?.greeneryIndex) ?? sup?.greenery_index ?? null;
      const ndvi = num(live?.ndvi) ?? sup?.ndvi ?? null;
      const lst = num(live?.lst) ?? sup?.lst ?? null;
      const treeCanopy = num(live?.treeCanopy) ?? sup?.tree_canopy ?? null;

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
          greenery_index: match ? match.greenery_index : null,
          ndvi: match ? match.ndvi : null,
          lst: match ? match.lst : null,
          tree_canopy: match ? match.tree_canopy : null,
          flood_exposure: match ? match.flood_exposure : null,
          current_intervention: match ? match.current_intervention : null,
        },
      };
    }),
  };
}
