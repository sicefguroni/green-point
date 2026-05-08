"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Per-barangay snapshot used both as input to `/api/recommendations/generate`
 * and as the cache key. If any field changes the cached AI recommendation is
 * considered stale and a fresh fetch is issued.
 */
export type BarangaySnapshot = {
  name: string;
  ndvi: number | null;
  lst: number | null;
  treeCanopy: number | null;
  greeneryIndex: number | null;
  floodHazard: number | null;
  stormHazard?: number | null;
  aqi?: number | null;
  taggedTreeCount?: number | null;
  inventoryCanopyFraction?: number | null;
  areaHectares?: number | null;
};

export type AIRecommendation = {
  name: string;
  interventionType: string;
  summary: string;
  justification: string;
  priority: "high" | "medium" | "low";
  overallRating: number;
};

/**
 * Per-barangay AI state. We hold *all* recommendations the API returns, not
 * just the top one, so the dashboard can pick the AI rec whose
 * `interventionType` matches the canonical strategy chosen deterministically
 * by `evaluateStrategies`. That way the dashboard headline always lines up
 * with the simulation's recommended intervention.
 */
export type AIRecState =
  | { status: "loading" }
  | { status: "ready"; recommendations: AIRecommendation[] }
  | { status: "error"; message: string };

type CacheEntry = {
  key: string;
  recommendations: AIRecommendation[];
  timestamp: number;
};

const CACHE_KEY = "dashboard-ai-recs:v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const CONCURRENCY = 3;

function snapshotKey(s: BarangaySnapshot): string {
  // Round numbers so trivial floating-point drift doesn't bust the cache.
  const n = (v: number | null | undefined, d = 2) =>
    v == null || !Number.isFinite(v) ? "x" : v.toFixed(d);
  return [
    s.name.trim().toLowerCase(),
    n(s.ndvi, 2),
    n(s.lst, 1),
    n(s.treeCanopy, 2),
    n(s.greeneryIndex, 2),
    n(s.floodHazard, 0),
    n(s.stormHazard, 0),
    n(s.aqi, 0),
    n(s.taggedTreeCount, 0),
    n(s.areaHectares, 0),
  ].join("|");
}

function loadCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const now = Date.now();
    const fresh: Record<string, CacheEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v !== "object") continue;
      const entry = v as Partial<CacheEntry> & {
        recommendation?: AIRecommendation;
      };
      if (typeof entry.timestamp !== "number") continue;
      if (now - entry.timestamp >= CACHE_TTL_MS) continue;

      // Migrate legacy entries that only stored a single `recommendation`.
      const recs = Array.isArray(entry.recommendations)
        ? entry.recommendations
        : entry.recommendation
          ? [entry.recommendation]
          : null;
      if (!recs || recs.length === 0) continue;

      fresh[k] = {
        key: entry.key ?? k,
        recommendations: recs,
        timestamp: entry.timestamp,
      };
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

function clearCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* non-fatal */
  }
}

async function fetchAIRecommendations(
  snapshot: BarangaySnapshot,
  signal: AbortSignal,
): Promise<AIRecommendation[]> {
  const res = await fetch("/api/recommendations/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      barangayName: snapshot.name,
      ndvi: snapshot.ndvi,
      lst: snapshot.lst,
      treeCanopy: snapshot.treeCanopy,
      greeneryIndex: snapshot.greeneryIndex,
      floodHazard: snapshot.floodHazard,
      stormHazard: snapshot.stormHazard ?? null,
      aqi: snapshot.aqi ?? null,
      taggedTreeCount: snapshot.taggedTreeCount ?? null,
      inventoryCanopyFraction: snapshot.inventoryCanopyFraction ?? null,
      areaHectares: snapshot.areaHectares ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: Array<{
      name?: string;
      interventionType?: string;
      summary?: string;
      justification?: string;
      priority?: string;
      overallRating?: number;
    }>;
  };
  if (!json.success || !json.data?.length) {
    throw new Error(json.error ?? "Empty response");
  }
  return json.data
    .map((r) => ({
      name: r.name ?? "Recommended Intervention",
      interventionType: r.interventionType ?? "—",
      summary: r.summary ?? "",
      justification: r.justification ?? "",
      priority: (r.priority as AIRecommendation["priority"]) ?? "medium",
      overallRating: typeof r.overallRating === "number" ? r.overallRating : 0,
    }))
    .sort((a, b) => b.overallRating - a.overallRating);
}

/**
 * Resolve an AI-generated greening recommendation per barangay using the
 * same RAG/OpenAI pipeline that powers the map tab's recommendation cards.
 *
 *   - Results are cached in localStorage (keyed by barangay metrics) so the
 *     dashboard does not spend OpenAI tokens on every page load.
 *   - In-flight requests are concurrency-limited (≤3) to avoid a thundering
 *     herd on first load.
 *   - The hook returns a per-name state map; the table can show a loading
 *     skeleton or the deterministic fallback while AI rows arrive.
 */
export function useAIRecommendations(
  snapshots: BarangaySnapshot[],
  options: { enabled?: boolean } = {},
): {
  byName: Record<string, AIRecState>;
  refresh: () => void;
  isFetching: boolean;
} {
  const enabled = options.enabled ?? true;
  const [byName, setByName] = useState<Record<string, AIRecState>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stable signature so the effect only re-runs when the underlying
  // barangay metric set really changes.
  const signature = useMemo(
    () =>
      enabled
        ? snapshots
            .map(snapshotKey)
            .sort()
            .join(",")
        : "",
    [snapshots, enabled],
  );
  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  useEffect(() => {
    if (!enabled || snapshotsRef.current.length === 0) {
      setByName({});
      setIsFetching(false);
      return;
    }

    const cache = loadCache();
    const initial: Record<string, AIRecState> = {};
    const work: BarangaySnapshot[] = [];
    for (const snap of snapshotsRef.current) {
      const key = snapshotKey(snap);
      const cached = cache[key];
      if (cached) {
        initial[snap.name] = {
          status: "ready",
          recommendations: cached.recommendations,
        };
      } else {
        initial[snap.name] = { status: "loading" };
        work.push(snap);
      }
    }
    setByName(initial);

    if (work.length === 0) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    const controller = new AbortController();
    let cancelled = false;
    let inFlight = 0;
    let cursor = 0;

    const tick = () => {
      if (cancelled) return;
      while (inFlight < CONCURRENCY && cursor < work.length) {
        const snap = work[cursor++];
        inFlight++;
        fetchAIRecommendations(snap, controller.signal)
          .then((recs) => {
            if (cancelled) return;
            const key = snapshotKey(snap);
            cache[key] = {
              key,
              recommendations: recs,
              timestamp: Date.now(),
            };
            saveCache(cache);
            setByName((prev) => ({
              ...prev,
              [snap.name]: { status: "ready", recommendations: recs },
            }));
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            const message =
              err instanceof Error ? err.message : "Failed to fetch";
            setByName((prev) => ({
              ...prev,
              [snap.name]: { status: "error", message },
            }));
          })
          .finally(() => {
            inFlight--;
            if (!cancelled && cursor >= work.length && inFlight === 0) {
              setIsFetching(false);
            }
            tick();
          });
      }
    };
    tick();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // refreshKey change triggers a forced re-fetch (cache already cleared).
  }, [signature, enabled, refreshKey]);

  const refresh = () => {
    clearCache();
    setRefreshKey((k) => k + 1);
  };

  return { byName, refresh, isFetching };
}
