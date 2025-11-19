import { BarangayMetrics } from "@/types/metrics";

export async function fetchBarangayMetrics(): Promise<BarangayMetrics[]> {
  try {
    const res = await fetch("/metrics/mandaue_metrics.json");
    if (!res.ok) throw new Error("Failed to load metric data");
    return await res.json();
  } catch (error) {
    console.error("Error loading metric data:", error);
    return [];
  }
}