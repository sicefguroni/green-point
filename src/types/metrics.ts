import { fetchBarangayMetrics } from "@/lib/api/metric_data"

export type BarangayDataMetrics = {
  name: string, 
  status: string, 
  area_km2: number,
  pop_density_perkm2: number,
  population: Record<string, number>, 
} 

const barangaymetricsArray = await fetchBarangayMetrics();

const barangayMetricsbyName: Record<string, BarangayDataMetrics> = 
  Object.fromEntries(barangaymetricsArray.map(b => [b.name, b]));

export async function getBarangayMetricbyName(): Promise<Record<string, BarangayDataMetrics>> {
  return barangayMetricsbyName;
}

export type CityMetrics = {
  name: string, 
  status: string, 
  population: Record<string, number>, 
}

// band aid solution for now lmao
export interface AirQualityIndex {
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

export interface FeatureHazardData {
  flood: { id: string; level: number | null }[];
  storm: { id: string; level: number | null }[];
  air: AirQualityIndex[]; 
}

export interface SelectedFeature {
  name: string; 
  address: string; 
  coords: {
    lng: number;
    lat: number;
  };
  properties?: mapboxgl.GeoJSONFeature["properties"];
  barangay: string;  
  hazards?: FeatureHazardData; 
}