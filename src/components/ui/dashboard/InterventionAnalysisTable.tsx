"use client";

import { useState, useMemo } from "react";
import { Download, Filter, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { getGreeneryTextColor } from "@/lib/chloroplet-colors";
import { formatPHP, formatSignedQuantity } from "@/lib/format-number";
import SimulationModal from "../simulation/Simulation";

import { useBarangay } from "@/context/BarangayContext";
import { useGeoData } from "@/context/geoDataStore";
import * as turf from "@turf/turf";
import { STRATEGY_LABELS } from "@/lib/simulation/presets";
import type { InterventionType } from "@/lib/simulation/coefficients";
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
import type { SimulationBaselineData } from "@/components/ui/simulation/simulation-types";

type Status = "Excellent" | "Good" | "Fair" | "Poor";

type TableRow = {
  id: number;
  barangay: string;
  equity: number;
  costPHP: number;
  costNormalized: number;
  impactGI: number;
  canopyDelta: number;
  /** ΔLST in °C. Negative (cooling) is the desirable direction. */
  coolingDeltaC: number;
  /** PM2.5 removed per year in kg (canonical run). */
  pm25KgPerYear: number;
  costPerImpact: number;
  status: Status;
  recommendedIntervention: string;
  recommendationKey: InterventionType;
  recommendationTagline: string;
  /** 0–100 composite rating (same formula the map tab's recommendation cards use). */
  overallRating: number;
  areaHectares: number;
  source: string;
};

/**
 * Build a row per barangay. For each one we evaluate all three canonical
 * strategies (urban canopy / green corridor / rain garden) with the same
 * scoring surface the map tab's recommendation cards use, and take the
 * highest-rated strategy as the "Recommended Intervention". Cost comes from
 * the shared cost model so it matches the map tab's cost card to the peso,
 * and budget-binding is deliberately disabled — the dashboard shows
 * "what it would take to build this", not "what fits inside a fixed pot".
 */
function buildRowFromFeature(
  feature: GeoJSON.Feature,
  idx: number,
): TableRow | null {
  const p = feature.properties;
  if (!p || typeof p !== "object") return null;
  const props = p as Record<string, unknown>;

  const name =
    typeof props.name === "string" ? props.name : `Barangay ${idx}`;

  let areaHectares = 0;
  try {
    if (feature.geometry) {
      const sqm = turf.area(feature);
      if (Number.isFinite(sqm) && sqm > 0) areaHectares = sqm / 10_000;
    }
  } catch {
    /* ignored */
  }
  if (areaHectares <= 0) {
    const km2 =
      typeof props.area_km2 === "number" && props.area_km2 > 0
        ? props.area_km2
        : 1;
    areaHectares = km2 * 100;
  }

  const baseline: SimulationBaselineData = {
    name,
    ndvi: typeof props.ndvi === "number" ? props.ndvi : 0.4,
    lst: typeof props.lst === "number" ? props.lst : 32,
    floodExposure:
      typeof props.flood_exposure === "string" ? props.flood_exposure : "Medium",
    greeneryIndex:
      typeof props.greenery_index === "number" ? props.greenery_index : 0.5,
    canopyCover:
      typeof props.tree_canopy === "number" ? props.tree_canopy : 25,
    currentIntervention:
      typeof props.current_intervention === "string"
        ? props.current_intervention
        : "None",
    areaHectares,
  };

  const ranked = evaluateStrategies(baseline);
  const best = ranked[0];
  const strategy = best.strategy;

  const costPerImpact =
    best.impactGI > 0 ? best.costPHP / best.impactGI : Number.POSITIVE_INFINITY;

  return {
    id: idx,
    barangay: name,
    equity: baseline.greeneryIndex,
    costPHP: best.costPHP,
    costNormalized: 0, // filled in a second pass below
    impactGI: best.impactGI,
    canopyDelta: best.canopyDeltaPct,
    coolingDeltaC: best.coolingDeltaC,
    pm25KgPerYear: best.pm25KgPerYear,
    costPerImpact,
    status: "Fair",
    recommendedIntervention: STRATEGY_LABELS[strategy].label,
    recommendationKey: strategy,
    recommendationTagline: STRATEGY_LABELS[strategy].tagline,
    overallRating: best.overallRating,
    areaHectares,
    source: "ESA / NASA / NOAH",
  };
}

function finalizeRows(rows: TableRow[]): TableRow[] {
  if (rows.length === 0) return rows;
  const costs = rows.map((r) => r.costPHP).filter((c) => Number.isFinite(c));
  const minCost = costs.length ? Math.min(...costs) : 0;
  const maxCost = costs.length ? Math.max(...costs) : 1;
  const span = Math.max(1, maxCost - minCost);

  return rows.map((r) => {
    const costNormalized = (r.costPHP - minCost) / span;
    // Status tracks the composite overall rating so it matches the map-tab
    // recommendation cards' ranking (same formula: `computeOverallRating`).
    let status: Status;
    if (r.overallRating >= 80) status = "Excellent";
    else if (r.overallRating >= 65) status = "Good";
    else if (r.overallRating >= 50) status = "Fair";
    else status = "Poor";
    return { ...r, costNormalized, status };
  });
}

export default function InterventionAnalysisTable() {
  const [equityRange, setEquityRange] = useState([0, 1]);
  const [costRange, setCostRange] = useState([0, 1]);
  const [sortColumn, setSortColumn] = useState<keyof TableRow>("costPerImpact");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);

  const { setSimulationBarangay } = useBarangay();
  const geoData = useGeoData((state) => state.geoData);

  function selectByName(name: string) {
    if (!geoData) return;

    const feature = geoData.features.find(
      (f: GeoJSON.Feature) =>
        f.properties?.name?.toLowerCase() === name.toLowerCase(),
    );
    if (!feature) return console.warn("Barangay not found:", name);

    let areaHectares: number | undefined;
    try {
      if (feature.geometry) {
        const sqm = turf.area(feature as GeoJSON.Feature);
        if (Number.isFinite(sqm) && sqm > 0) areaHectares = sqm / 10_000;
      }
    } catch (err) {
      console.warn("Failed to compute barangay area:", err);
    }

    setSimulationBarangay({
      name: feature.properties?.name ?? name,
      greeneryIndex: feature.properties?.greenery_index ?? 0,
      ndvi: feature.properties?.ndvi ?? 0,
      lst: feature.properties?.lst ?? 0,
      treeCanopy: feature.properties?.tree_canopy ?? 0,
      floodExposure: feature.properties?.flood_exposure ?? "unknown",
      currentIntervention: feature.properties?.current_intervention ?? "None",
      areaHectares,
    });
  }

  const tableData = useMemo(() => {
    if (!geoData) return [];
    const raw = geoData.features
      .map((f: GeoJSON.Feature, i: number) => buildRowFromFeature(f, i))
      .filter((r): r is TableRow => r !== null);
    return finalizeRows(raw);
  }, [geoData]);

  const filteredData = useMemo(() => {
    const filtered = tableData.filter((row) => {
      const equityMatch =
        row.equity >= equityRange[0] && row.equity <= equityRange[1];
      const costMatch =
        row.costNormalized >= costRange[0] &&
        row.costNormalized <= costRange[1];
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
      setSortDirection(column === "costPerImpact" || column === "costPHP" ? "asc" : "desc");
    }
  };

  const getStatusColor = (status: Status) => {
    const colors = {
      Excellent: "bg-green-100 text-green-700 border-green-200",
      Good: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Fair: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Poor: "bg-red-100 text-red-700 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const resetFilters = () => {
    setEquityRange([0, 1]);
    setCostRange([0, 1]);
    setSortColumn("costPerImpact");
    setSortDirection("asc");
  };

  const exportCSV = () => {
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
      "Recommended Intervention",
      "Overall Rating",
    ];
    const rows = filteredData.map((r) => [
      r.barangay,
      r.equity.toFixed(3),
      r.areaHectares.toFixed(2),
      r.costPHP,
      r.impactGI.toFixed(3),
      r.canopyDelta.toFixed(1),
      r.coolingDeltaC.toFixed(2),
      r.pm25KgPerYear.toFixed(2),
      Number.isFinite(r.costPerImpact) ? Math.round(r.costPerImpact) : "n/a",
      r.status,
      r.recommendedIntervention,
      r.overallRating.toFixed(1),
    ]);
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
  };

  return (
    <div className="space-y-4">
      <div className="h-[480px] bg-white dark:bg-neutral-900 rounded-xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">
                Barangay Cost-Effectiveness Intervention Analysis
              </h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
                Showing {filteredData.length} of {tableData.length} barangays ·
                Top-rated intervention per barangay (same composite scoring
                as the map tab) · Cost from the shared cost-estimate model
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-300 uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700">
                Source: ESA / NASA / NOAH
              </span>
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Barangay
                  </th>
                  <SortableTh
                    label="Equity Index"
                    active={sortColumn === "equity"}
                    onClick={() => handleSort("equity")}
                  />
                  <SortableTh
                    label="Est. Cost"
                    active={sortColumn === "costPHP"}
                    onClick={() => handleSort("costPHP")}
                  />
                  <SortableTh
                    label="Impact ΔGI"
                    active={sortColumn === "impactGI"}
                    onClick={() => handleSort("impactGI")}
                  />
                  <SortableTh
                    label="Cooling ΔLST"
                    active={sortColumn === "coolingDeltaC"}
                    onClick={() => handleSort("coolingDeltaC")}
                  />
                  <SortableTh
                    label="PM2.5 removed"
                    active={sortColumn === "pm25KgPerYear"}
                    onClick={() => handleSort("pm25KgPerYear")}
                  />
                  <SortableTh
                    label="PHP per ΔGI"
                    active={sortColumn === "costPerImpact"}
                    onClick={() => handleSort("costPerImpact")}
                  />
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Recommended Intervention
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                {filteredData.length > 0 ? (
                  filteredData.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`${index % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50 dark:bg-neutral-950"} hover:bg-blue-50 dark:hover:bg-neutral-800 transition-colors`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-neutral-100">
                          {row.barangay}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-neutral-500">
                          {row.areaHectares.toFixed(1)} ha
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-semibold ${getGreeneryTextColor(row.equity)}`}
                        >
                          {row.equity.toFixed(2)}
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        title={`₱${row.costPHP.toLocaleString()} — same pricing as the map tab's cost estimate card.`}
                      >
                        <div className="text-sm font-semibold text-gray-800 dark:text-neutral-200 tabular-nums">
                          {formatPHP(row.costPHP)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-800 dark:text-neutral-200 tabular-nums">
                          {formatSignedQuantity(row.impactGI, "")}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-neutral-500">
                          +{row.canopyDelta.toFixed(1)}% canopy
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        title="Change in Land Surface Temperature. Negative (blue) means cooler; positive (red) means the scenario warms net of climate drift."
                      >
                        <div
                          className={`text-sm font-semibold tabular-nums ${
                            row.coolingDeltaC < 0
                              ? "text-sky-600 dark:text-sky-400"
                              : row.coolingDeltaC > 0.05
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-700 dark:text-neutral-200"
                          }`}
                        >
                          {row.coolingDeltaC > 0 ? "+" : ""}
                          {row.coolingDeltaC.toFixed(2)}°C
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        title="PM2.5 removed per year by the new vegetation (i-Tree Eco coefficients). Higher is better."
                      >
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {row.pm25KgPerYear.toFixed(1)} kg/yr
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-neutral-200 tabular-nums">
                        {Number.isFinite(row.costPerImpact)
                          ? formatPHP(row.costPerImpact)
                          : "n/a"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                            {row.recommendedIntervention}
                          </p>
                          <span
                            className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                            title="Composite overall rating — same formula used by the recommendation cards on the map tab (efficiency, equity, impact, value, relevancy, feasibility)."
                          >
                            {row.overallRating.toFixed(0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-neutral-500 max-w-[220px] truncate">
                          {row.recommendationTagline}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          className="hover:bg-primary-green/90 transition-colors duration-200 bg-primary-green text-white text-sm px-3 py-1 rounded-md cursor-pointer"
                          onClick={() => {
                            selectByName(row.barangay);
                            setIsSimulationOpen(true);
                          }}
                        >
                          Simulate
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="text-gray-400 dark:text-neutral-500">
                        <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg font-medium text-gray-600 dark:text-neutral-300">
                          No barangays match your filters
                        </p>
                        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                          Try adjusting the range sliders above
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-gray-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100">
              Weighting Scenario by Equity and Cost
            </h3>
          </div>
          <button
            className="text-sm text-neutral-black dark:text-neutral-200 hover:text-neutral-black/80 dark:hover:text-white font-medium transition-colors"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <RangeControl
            label="Equity Index"
            accent="green"
            min={0}
            max={1}
            step={0.01}
            value={equityRange}
            onChange={setEquityRange}
            formatValue={(v) => v.toFixed(2)}
            footerLabels={["0.00", "1.00"]}
          />
          <RangeControl
            label="Cost (relative to dataset)"
            accent="emerald"
            min={0}
            max={1}
            step={0.01}
            value={costRange}
            onChange={setCostRange}
            formatValue={(v) => v.toFixed(2)}
            footerLabels={[
              tableData.length
                ? formatPHP(Math.min(...tableData.map((r) => r.costPHP)))
                : "—",
              tableData.length
                ? formatPHP(Math.max(...tableData.map((r) => r.costPHP)))
                : "—",
            ]}
          />
        </div>
      </div>

      {isSimulationOpen && (
        <SimulationModal
          isOpen={isSimulationOpen}
          setIsOpen={setIsSimulationOpen}
        />
      )}
    </div>
  );
}

function SortableTh({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${active ? "text-green-600" : ""}`}
        />
      </div>
    </th>
  );
}

function RangeControl({
  label,
  accent,
  min,
  max,
  step,
  value,
  onChange,
  formatValue,
  footerLabels,
}: {
  label: string;
  accent: "green" | "emerald";
  min: number;
  max: number;
  step: number;
  value: number[];
  onChange: (v: number[]) => void;
  formatValue: (v: number) => string;
  footerLabels: [string, string];
}) {
  const valueColor =
    accent === "green"
      ? "text-green-600 dark:text-green-400"
      : "text-emerald-600 dark:text-emerald-400";
  const sliderColor =
    accent === "green" ? "accent-green-500" : "accent-emerald-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">
          {label}
        </label>
        <span className={`text-sm font-semibold ${valueColor}`}>
          {formatValue(value[0])} - {formatValue(value[1])}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
              Min
            </label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value[0]}
              onChange={(e) =>
                onChange([parseFloat(e.target.value), value[1]])
              }
              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${sliderColor}`}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-neutral-500 mb-1 block">
              Max
            </label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value[1]}
              onChange={(e) =>
                onChange([value[0], parseFloat(e.target.value)])
              }
              className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${sliderColor}`}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 dark:text-neutral-500">
          <span>{footerLabels[0]}</span>
          <span>{footerLabels[1]}</span>
        </div>
      </div>
    </div>
  );
}
