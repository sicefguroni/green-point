"use client";

import { useEffect, useState } from "react";
import {
  fetchCityMetricAggregates,
  type CityMetricAggregates,
} from "@/lib/api/city-metrics";

export function useCityMetricAggregates() {
  const [metrics, setMetrics] = useState<CityMetricAggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchCityMetricAggregates()
      .then((data) => {
        if (mounted) setMetrics(data);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { metrics, loading, error };
}
