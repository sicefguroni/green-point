import { fetchBarangayMetrics } from "@/lib/api/metric_data";

export type BarangayDataMetrics = {
  name: string;
  status: string;
  area_km2: number;
  pop_density_perkm2: number;
  population: Record<string, number>;
};

const barangaymetricsArray = await fetchBarangayMetrics();

const barangayMetricsbyName: Record<string, BarangayDataMetrics> =
  Object.fromEntries(barangaymetricsArray.map((b) => [b.name, b]));

export async function getBarangayMetricbyName(): Promise<
  Record<string, BarangayDataMetrics>
> {
  return barangayMetricsbyName;
}

export interface FeatureHazardData {
  flood: { id: string; level: number | null }[];
  storm: { id: string; level: number | null }[];
  air: { AQI_Level: number | null }[]; // Air quality data from external API
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
  customSelectionGeometry?: GeoJSON.Polygon | null;
  customSelectionAreaHectares?: number | null;
  hazards?: FeatureHazardData;
  isLoadingMetrics?: boolean;
}

export interface MetricDescriptions {
  name: string;
  description: string;
  what?: string;
  why?: string;
  source?: string;
  frequency?: string;
}
