import { fetchBarangayMetrics } from "@/lib/api/metric_data";

export type BarangayDataMetrics = {
  name: string;
  status: string;
  area_km2: number;
  pop_density_perkm2: number;
  population: Record<string, number>;
};

let barangayMetricsbyName: Record<string, BarangayDataMetrics> | null = null;

export async function getBarangayMetricbyName(): Promise<
  Record<string, BarangayDataMetrics>
> {
  if (!barangayMetricsbyName) {
    const barangaymetricsArray = await fetchBarangayMetrics();
    barangayMetricsbyName = Object.fromEntries(
      barangaymetricsArray.map((b) => [b.name, b])
    );
  }
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
  pointID?: string | null;
  coords: {
    lng: number;
    lat: number;
  };
  properties?: mapboxgl.GeoJSONFeature["properties"];
  barangay: string;
  customSelectionGeometry?: GeoJSON.Polygon | null;
  customSelectionAreaHectares?: number | null;
  /** Fixed-radius footprint used for pin / point selections. */
  pointSelectionAreaHectares?: number | null;
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
