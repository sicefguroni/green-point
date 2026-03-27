import { fetchWaqiAtPoint } from "@/lib/api/environment";
import type mapboxgl from "mapbox-gl";

/**
 * Air quality index data from external API (WAQI)
 * This is a frontend-only type for API response transformation
 */
interface AirQualityIndex {
  city: string;
  AQI_Level: number;
  properties: {
    nh3: number;
    no: number;
    no2: number;
    o3: number;
    pm2_5: number;
    pm10: number;
    so2: number;
  };
}

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

/**
 * Returns live air quality data from WAQI for the selected point, wrapped into
 * the existing AirQualityIndex shape used by the dashboard.
 */
export async function getAirQualityData(
  latitude: number,
  longitude: number,
): Promise<AirQualityIndex[]> {
  const waqi = await fetchWaqiAtPoint(latitude, longitude);
  if (!waqi) return [];

  return [
    {
      city: waqi.city,
      AQI_Level: waqi.aqi ?? -1,
      properties: {
        nh3: waqi.components.nh3 ?? 0,
        no: waqi.components.no2 ?? 0,
        no2: waqi.components.no2 ?? 0,
        o3: waqi.components.o3 ?? 0,
        pm2_5: waqi.components.pm25 ?? 0,
        pm10: waqi.components.pm10 ?? 0,
        so2: waqi.components.so2 ?? 0,
      },
    },
  ];
}
