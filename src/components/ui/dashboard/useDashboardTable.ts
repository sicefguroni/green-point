"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
import {
  buildRagStrategyCardsForSimulation,
} from "@/lib/simulation/explore-strategy-order";
import { resolveStrategyKey } from "@/lib/simulation/cost-model";
import type { InterventionType } from "@/lib/simulation/coefficients";
import {
  resolveRowDisplay,
  normalizeFeatureCollection,
  buildRowFromFeature,
  finalizeRows,
  featureToBaseline,
  type RowDisplay,
} from "./dashboard-table-utils";
import type { StaticBarangayMetricRow, BulkRecEntry, TableRow } from "./dashboard-table-types";
import { useAIRecommendations, type AIRecommendation } from "./use-ai-recommendations";
import { buildInterventionCsv, downloadBlob } from "./intervention-export";

/** A table row plus the values it displays (see `resolveRowDisplay`). */
export type DisplayedRow = {
  row: TableRow;
  display: RowDisplay;
  aiList: AIRecommendation[] | null;
  /** Displayed cost scaled 0–1 across the dataset, for the cost filter. */
  costNormalized: number;
};

/** Sort on what the row shows, not on the engine's hidden pick. */
function sortValue(item: DisplayedRow, column: keyof TableRow): number | null {
  const { row, display } = item;
  switch (column) {
    case "lifecycleCost":
    case "costPHP":
      return display.cost;
    case "impactGI":
      return display.impactGI;
    case "coolingDeltaC":
      return display.coolingDeltaC;
    case "pm25KgPerYear":
      return display.pm25;
    case "costPerImpact":
      return display.costPerImpact;
    case "overallRating":
      return display.overallRating;
    default: {
      const value = row[column];
      return typeof value === "number" ? value : null;
    }
  }
}

/**
 * Hook that powers the InterventionAnalysisTable: data fetching, filtering,
 * sorting, AI recommendation orchestration, and backfill.
 */
export function useDashboardTable() {
  const [equityRange, setEquityRange] = useState([0, 1]);
  const [costRange, setCostRange] = useState([0, 1]);
  const [sortColumn, setSortColumn] = useState<keyof TableRow>("costPerImpact");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [labelRows, setLabelRows] = useState<StaticBarangayMetricRow[]>([]);
  const [bulkRecsByName, setBulkRecsByName] = useState<
    Record<string, BulkRecEntry[]>
  >({});
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const { setSimulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  // ── Data fetching ────────────────────────────────────────────────────────

  // Fetch bulk recs from the GreeningRecommendation table on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/recommendations/by-barangay")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success || !json?.data) return;
        setBulkRecsByName(json.data as Record<string, BulkRecEntry[]>);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the static flood/intervention labels (the file has no metrics)
  useEffect(() => {
    let isMounted = true;
    fetch("/geo/mandaue_barangays_gi.geojson")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!isMounted || !Array.isArray(rows)) return;
        setLabelRows(
          rows.filter(
            (row): row is StaticBarangayMetricRow =>
              row &&
              typeof row === "object" &&
              typeof (row as StaticBarangayMetricRow).name === "string",
          ),
        );
      })
      .catch(() => {
        if (isMounted) setLabelRows([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const tableData = useMemo(() => {
    const features = normalizeFeatureCollection(geoData, labelRows);
    const raw = features
      .map((f, i) => {
        const name = f.properties?.name as string | undefined;
        const recs = bulkRecsByName[name ?? ""] ?? null;
        return buildRowFromFeature(f, i, recs, null);
      })
      .filter((r): r is TableRow => r !== null);
    return finalizeRows(raw);
  }, [geoData, labelRows, bulkRecsByName]);

  // Run the same RAG/OpenAI pipeline the map tab uses, per barangay
  const snapshots = useMemo(() => tableData.map((r) => r.snapshot), [tableData]);
  const {
    byName: aiByName,
    refresh: refreshAI,
    isFetching: isFetchingAI,
  } = useAIRecommendations(snapshots);

  // When AI recommendations arrive, merge their cost/impact data into
  // bulkRecsByName so the table cost column updates on "Refresh".
  const prevAiRef = useRef<string>("");
  useEffect(() => {
    const sig = Object.keys(aiByName)
      .filter((k) => aiByName[k]?.status === "ready")
      .sort()
      .join(",");
    if (!sig || sig === prevAiRef.current) return;
    prevAiRef.current = sig;

    setBulkRecsByName((prev) => {
      const next = { ...prev };
      for (const [name, state] of Object.entries(aiByName)) {
        if (state?.status !== "ready") continue;
        const existing = next[name] ?? [];
        const aiRecs = state.recommendations;
        // Merge AI recs with existing bulk recs, preferring AI data
        const merged = [...aiRecs, ...existing];
        // Deduplicate by interventionType, keeping AI version first
        const seen = new Set<string>();
        next[name] = merged.filter((r) => {
          const key = r.interventionType.toLowerCase().trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      return next;
    });
  }, [aiByName]);

  // ── Displayed values ─────────────────────────────────────────────────────

  const { displayedRows, costBounds } = useMemo(() => {
    const resolved = tableData.map((row) => {
      const ai = aiByName[row.barangay];
      const aiList = ai?.status === "ready" ? ai.recommendations : null;
      return { row, aiList, display: resolveRowDisplay(row, aiList) };
    });
    const costs = resolved
      .map((item) => item.display.cost)
      .filter((cost) => Number.isFinite(cost));
    const bounds = costs.length
      ? { min: Math.min(...costs), max: Math.max(...costs) }
      : null;
    const span = bounds ? Math.max(1, bounds.max - bounds.min) : 1;
    return {
      costBounds: bounds,
      displayedRows: resolved.map<DisplayedRow>((item) => ({
        ...item,
        costNormalized: bounds ? (item.display.cost - bounds.min) / span : 0,
      })),
    };
  }, [tableData, aiByName]);

  // ── Filtering / sorting ──────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    const filtered = displayedRows.filter(({ row, costNormalized }) => {
      const equityMatch = row.equity >= equityRange[0] && row.equity <= equityRange[1];
      const costMatch =
        costNormalized >= costRange[0] && costNormalized <= costRange[1];
      return equityMatch && costMatch;
    });

    filtered.sort((a, b) => {
      const aVal = sortValue(a, sortColumn);
      const bVal = sortValue(b, sortColumn);
      if (aVal === null || bVal === null) return 0;
      const aSafe = Number.isFinite(aVal) ? aVal : Number.MAX_SAFE_INTEGER;
      const bSafe = Number.isFinite(bVal) ? bVal : Number.MAX_SAFE_INTEGER;
      return sortDirection === "asc" ? aSafe - bSafe : bSafe - aSafe;
    });

    return filtered;
  }, [displayedRows, equityRange, costRange, sortColumn, sortDirection]);

  const handleSort = (column: keyof TableRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(
        column === "costPerImpact" || column === "costPHP" || column === "lifecycleCost" ? "asc" : "desc",
      );
    }
  };

  const resetFilters = () => {
    setEquityRange([0, 1]);
    setCostRange([0, 1]);
    setSortColumn("costPerImpact");
    setSortDirection("asc");
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const selectByName = useCallback(
    (
      name: string,
      recommendedStrategy?: InterventionType,
      aiList?: AIRecommendation[] | null,
    ) => {
      const features = normalizeFeatureCollection(geoData, labelRows);
      if (features.length === 0) return;

      const feature = features.find(
        (f: GeoJSON.Feature<GeoJSON.Geometry | null>) =>
          f.properties?.name?.toLowerCase() === name.toLowerCase(),
      );
      if (!feature) {
        console.warn("Barangay not found:", name);
        return;
      }

      const baseline = featureToBaseline(feature, 0);
      if (!baseline) {
        console.warn("Could not build baseline:", name);
        return;
      }

      const matchingRec = (aiList ?? []).find((rec) => {
        const mapped = resolveStrategyKey(rec.interventionType);
        return recommendedStrategy ? mapped === recommendedStrategy : true;
      });
      const filteredCards = matchingRec ? [matchingRec] : null;

      setSimulationBarangay({
        name: baseline.name ?? name,
        greeneryIndex: baseline.greeneryIndex,
        ndvi: baseline.ndvi,
        lst: baseline.lst,
        treeCanopy: baseline.canopyCover,
        floodExposure: baseline.floodExposure,
        currentIntervention: baseline.currentIntervention,
        areaHectares: baseline.areaHectares,
        recommendedStrategy,
        ragStrategyCards: buildRagStrategyCardsForSimulation(filteredCards),
      });
    },
    [geoData, labelRows, setSimulationBarangay],
  );

  const handleBackfill = useCallback(async () => {
    if (isBackfilling) return;
    setIsBackfilling(true);
    setBackfillMessage(null);
    try {
      const res = await fetch("/api/recommendations/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        const msg = json.message || `Processed ${json.processed} barangays.`;
        setBackfillMessage(msg);
        // Re-fetch bulk recs
        const reFetch = await fetch("/api/recommendations/by-barangay");
        const reJson = await reFetch.json();
        if (reJson?.success && reJson?.data) {
          setBulkRecsByName(reJson.data as Record<string, BulkRecEntry[]>);
        }
        refreshAI();
      } else {
        setBackfillMessage(json.error || "Backfill failed.");
      }
    } catch (err) {
      setBackfillMessage(
        err instanceof Error ? err.message : "Backfill request failed.",
      );
    } finally {
      setIsBackfilling(false);
    }
  }, [isBackfilling, refreshAI]);

  const exportCSV = useCallback(() => {
    if (filteredData.length === 0) return;
    // Same values as the on-screen row (resolveRowDisplay), column for column.
    downloadBlob(
      new Blob([buildInterventionCsv(filteredData)], { type: "text/csv" }),
      `intervention-analysis-${Date.now()}.csv`,
    );
  }, [filteredData]);

  return {
    // State
    equityRange,
    costRange,
    sortColumn,
    sortDirection,
    isSimulationOpen,
    setIsSimulationOpen,
    isBackfilling,
    backfillMessage,
    // Derived
    tableData,
    filteredData,
    costBounds,
    aiByName,
    isFetchingAI,
    // Actions
    handleSort,
    resetFilters,
    setEquityRange,
    setCostRange,
    selectByName,
    handleBackfill,
    exportCSV,
    refreshAI,
  } as const;
}
