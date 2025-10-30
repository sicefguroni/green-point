interface GreeneryIndexData {
  name: string;
  greenery_index: number;
  ndvi: number;
  lst: number;
  tree_canopy: number;
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
        }
      }
    })
  }
}