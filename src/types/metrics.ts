import { fetchBarangayMetrics } from "@/lib/api/metric_data"

export type BarangayMetrics = {
  name: string, 
  status: string, 
  area_km2: number,
  pop_density_perkm2: number,
  population: Record<string, number>, 
} 

const barangaymetricsArray = await fetchBarangayMetrics();

const barangayMetricsbyName: Record<string, BarangayMetrics> = 
  Object.fromEntries(barangaymetricsArray.map(b => [b.name, b]));

export async function getBarangayMetricbyName(): Promise<Record<string, BarangayMetrics>> {
  return barangayMetricsbyName;
}

export type CityMetrics = {
  name: string, 
  status: string, 
  population: Record<string, number>, 
}