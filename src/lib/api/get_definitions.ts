import { MetricDescriptions } from "@/types/metrics";

export async function fetchMetricDescriptions(): Promise<MetricDescriptions[]> {
  try {
    const res = await fetch("/terms/termdefs.json");
    if (!res.ok) throw new Error("Failed to load metric definitions");
    return await res.json();
  } catch (error) {
    console.error("Error loading metric definitions:", error);
    return [];
  }
}