interface FloodFeatureProperties {
  Var: 1 | 2 | 3; // flood hazard level
}

interface StormFeatureProperties {
  HAZ: 1 | 2 | 3; // storm surge hazard level
}
function getLayerFeatures<T extends mapboxgl.GeoJSONFeature>(
  map: mapboxgl.Map,
  point: mapboxgl.PointLike,
  layers: string[]
): T[] {
  return map.queryRenderedFeatures(point, { layers }) as T[];
}

interface AirQualityIndex {
  city: string, 
  AQI_Level: number,
  properties: {
    "nh3": number,
    "no": number,
    "no2": number,
    "o3": number,
    "pm2_5": number,
    "pm10": number,
    "so2": number
  }
}

export function getFloodData(map: mapboxgl.Map, point: mapboxgl.PointLike) {
  const layers = ["floodLayer5Yr", "floodLayer25Yr", "floodLayer100Yr"];

  return layers.map(id => {
    const features = getLayerFeatures<
      mapboxgl.GeoJSONFeature & { properties: FloodFeatureProperties }
    >(map, point, [id]);

    return { id, level: features[0]?.properties.Var ?? null };
  });
}

export function getStormData(map: mapboxgl.Map, point: mapboxgl.PointLike) {
  const layers = ["stormLayerAdv1", "stormLayerAdv2", "stormLayerAdv3", "stormLayerAdv4"];

  return layers.map(id => {
    const features = getLayerFeatures<
      mapboxgl.GeoJSONFeature & { properties: StormFeatureProperties }
    >(map, point, [id]);

    return { id, level: features[0]?.properties.HAZ ?? null };
  });
}

async function fetchMandaueAirQualityIndex(): Promise<AirQualityIndex[]> {
  try {
    const res = await fetch("/metrics/airqual_index.json");
    if (!res.ok) throw new Error("Failed to load air quality data");
    return await res.json();
  } catch (error) {
    console.error("Error loading air quality data:", error);
    return [];
  }
}

export function getAirQualityData() {
  return fetchMandaueAirQualityIndex();
}