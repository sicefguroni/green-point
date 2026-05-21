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
  resolveDisplayStrategy,
  normalizeFeatureCollection,
  buildRowFromFeature,
  finalizeRows,
  featureToBaseline,
} from "./dashboard-table-utils";
import type { StaticBarangayMetricRow, BulkRecEntry, TableRow } from "./dashboard-table-types";
import { useAIRecommendations } from "./use-ai-recommendations";

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
  const [fallbackRows, setFallbackRows] = useState<StaticBarangayMetricRow[]>([]);
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

  // Load static metric rows
  useEffect(() => {
    let isMounted = true;
    fetch("/geo/mandaue_barangays_gi.geojson")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!isMounted || !Array.isArray(rows)) return;
        setFallbackRows(
          rows.filter(
            (row): row is StaticBarangayMetricRow =>
              row &&
              typeof row === "object" &&
              typeof (row as StaticBarangayMetricRow).name === "string",
          ),
        );
      })
      .catch(() => {
        if (isMounted) setFallbackRows([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const tableData = useMemo(() => {
    const features = normalizeFeatureCollection(geoData, fallbackRows);
    const raw = features
      .map((f, i) => {
        const name = f.properties?.name as string | undefined;
        const recs = bulkRecsByName[name ?? ""] ?? null;
        return buildRowFromFeature(f, i, recs, null);
      })
      .filter((r): r is TableRow => r !== null);
    return finalizeRows(raw);
  }, [geoData, fallbackRows, bulkRecsByName]);

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

  // ── Filtering / sorting ──────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    const filtered = tableData.filter((row) => {
      const equityMatch = row.equity >= equityRange[0] && row.equity <= equityRange[1];
      const costMatch =
        row.costNormalized >= costRange[0] && row.costNormalized <= costRange[1];
      return equityMatch && costMatch;
    });

    filtered.sort((a: TableRow, b: TableRow) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal !== "number" || typeof bVal !== "number") return 0;
      const aSafe = Number.isFinite(aVal) ? aVal : Number.MAX_SAFE_INTEGER;
      const bSafe = Number.isFinite(bVal) ? bVal : Number.MAX_SAFE_INTEGER;
      return sortDirection === "asc" ? aSafe - bSafe : bSafe - aSafe;
    });

    return filtered;
  }, [tableData, equityRange, costRange, sortColumn, sortDirection]);

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
      aiList?: import("./use-ai-recommendations").AIRecommendation[] | null,
    ) => {
      const features = normalizeFeatureCollection(geoData, fallbackRows);
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
    [geoData, fallbackRows, setSimulationBarangay],
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
    const header = [
      "Barangay",
      "Equity Index",
      "Area (ha)",
      "Est. Cost (PHP)",
      "Impact (ΔGI)",
      "Canopy Δ (%)",
      "Cooling ΔLST (°C)",
      "PM2.5 removed (kg/yr)",
      "PHP per ΔGI",
      "Status",
      "Recommended Strategy",
      "AI Headline",
      "Overall Rating",
    ];
    const rows = filteredData.map((r) => {
      const ai = aiByName[r.barangay];
      const aiList = ai?.status === "ready" ? ai.recommendations : null;
      const display = resolveDisplayStrategy(r, aiList);
      return [
        r.barangay,
        r.equity.toFixed(3),
        r.areaHectares.toFixed(2),
        r.lifecycleCost, // matches explore sidebar cost estimate card
        display.evalForStrategy.impactGI.toFixed(3),
        display.evalForStrategy.canopyDeltaPct.toFixed(1),
        display.evalForStrategy.coolingDeltaC.toFixed(2),
        display.evalForStrategy.pm25KgPerYear.toFixed(2),
        display.evalForStrategy.impactGI > 0
          ? Math.round(r.lifecycleCost / display.evalForStrategy.impactGI)
          : "n/a",
        r.status,
        r.recommendedIntervention,
        display.aiRec?.name ?? "",
        (display.aiRec?.overallRating ?? display.evalForStrategy.overallRating).toFixed(0),
      ];
    });
    const csv = [header, ...rows]
      .map((line) =>
        line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intervention-analysis-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredData, aiByName]);

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
