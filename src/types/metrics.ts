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