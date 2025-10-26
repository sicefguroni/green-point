export function mergeGI(geoJSON: GeoJSON.FeatureCollection, giJSON: GeoJSON.FeatureCollection) {
  return {
    ...geoJSON,
    features: geoJSON.features.map(feature => {
      const name = feature.properties?.name;
      const match = giJSON.features.find(d => d.properties?.name === name);
      return {
        ...feature,
        properties: {
          ...feature.properties, 
          greenery_index: match ? match.properties?.greenery_index : null,
          ndvi: match ? match.properties?.ndvi : null,
          lst: match ? match.properties?.lst : null,
          tree_canopy: match ? match.properties?.tree_canopy : null,
        }
      }
    })
  }
}