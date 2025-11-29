interface GreeneryIndexData {
  name: string;
  greenery_index: number;
  ndvi: number;
  lst: number;
  tree_canopy: number;
  flood_exposure: string;
  current_intervention: string;
}

export interface APIBarangayData {
  brgy_name: string;
  gi_score: number;
  ndvi_mean: number;
  mean_lst: number;
  canopy_cover_pct: number;
  flood_exposure: string;
  [key: string]: string | number;
}

export function mergeGI(geoJSON: GeoJSON.FeatureCollection, giJSON: GreeneryIndexData[]) {
  return {
    ...geoJSON,
    features: geoJSON.features.map(feature => {
      const name = feature.properties?.name;
      const match = giJSON.find(d => d.name === name);
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
        }
      }
    })
  }
}

// Clean barangay name for display (remove (Pob.) suffix)
export function cleanBarangayName(name: string): string {
  return name.replace(/\s*\(Pob\.\)\s*$/i, '').trim();
}

export function mergeAPIData(geoJSON: GeoJSON.FeatureCollection, apiData: APIBarangayData[]) {
  return {
    ...geoJSON,
    features: geoJSON.features.map(feature => {
      const name = feature.properties?.name;
      // Try to match by normalizing names
      const normalizeName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      const normalizedName = normalizeName(name || "");
      const match = apiData.find(d => normalizeName(d.brgy_name) === normalizedName);
      
      return {
        ...feature,
        properties: {
          ...feature.properties,
          name: cleanBarangayName(feature.properties?.name || ""),
          greenery_index: match ? match.gi_score : null,
          ndvi: match ? match.ndvi_mean : null,
          lst: match ? match.mean_lst : null,
          tree_canopy: match ? match.canopy_cover_pct : null,
          flood_exposure: match?.flood_exposure || null,
          current_intervention: null,
        }
      }
    })
  }
}