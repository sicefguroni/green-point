"use client";

import { useEffect, useState } from "react";
import {
  fetchCityMetricAggregates,
  type CityMetricAggregates,
} from "@/lib/api/city-metrics";

type UseCityMetricAggregatesOptions = {
  /**
   * When true, defer the fetch until the browser is idle (or after a short timeout).
   * Use on the landing page so main thread + map work get priority.
   */
  deferUntilIdle?: boolean;
};

export function useCityMetricAggregates(
  options?: UseCityMetricAggregatesOptions,
) {
  const deferUntilIdle = options?.deferUntilIdle ?? false;
  const [metrics, setMetrics] = useState<CityMetricAggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let ran = false;

    const run = () => {
      if (!mounted || ran) return;
      ran = true;
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
    };

    if (!deferUntilIdle) {
      run();
      return () => {
        mounted = false;
      };
    }

    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    if (typeof requestIdleCallback !== "undefined") {
      idleHandle = requestIdleCallback(run, { timeout: 2000 });
    } else {
      timeoutHandle = setTimeout(run, 0);
    }

    return () => {
      mounted = false;
      if (idleHandle !== undefined && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, [deferUntilIdle]);

  return { metrics, loading, error };
}
