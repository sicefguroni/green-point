"use client";

import {
  TrendingUp,
  MapPin,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { formatPHP, formatSignedQuantity } from "@/lib/format-number";
import { STRATEGY_LABELS } from "@/lib/simulation/presets";
import type { InterventionType } from "@/lib/simulation/coefficients";
import SimulationModal from "../simulation/Simulation";
import {
  equityBadgeClass,
  impactGiBadgeClass,
  resolveDisplayStrategy,
} from "./dashboard-table-utils";
import type { Status, TableRow } from "./dashboard-table-types";
import type { AIRecommendation } from "./use-ai-recommendations";
import { useDashboardTable } from "./useDashboardTable";
import {
  SortableTh,
  StatusBadge,
  TableEmptyState,
  TableActionButtons,
  TableFilters,
} from "./DashboardTableSubComponents";

export default function InterventionAnalysisTable() {
  const {
    equityRange,
    costRange,
    sortColumn,
    isSimulationOpen,
    setIsSimulationOpen,
    isBackfilling,
    backfillMessage,
    tableData,
    filteredData,
    aiByName,
    isFetchingAI,
    handleSort,
    resetFilters,
    setEquityRange,
    setCostRange,
    selectByName,
    handleBackfill,
    exportCSV,
    refreshAI,
  } = useDashboardTable();

  return (
    <div className="space-y-5">
      {/* ── Header Card ── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#16881b] to-[#4caf50] shadow-lg shadow-green-900/20 dark:shadow-green-900/40 overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white font-poppins tracking-tight">
                Barangay Cost-Effectiveness Analysis
              </h3>
              <p className="text-sm text-green-100 mt-1 max-w-2xl">
                Showing {filteredData.length} of {tableData.length} barangays —
                scores from the simulation engine (context fit, impact, cost) ·
                descriptions from matched AI recommendations
              </p>
            </div>
            <TableActionButtons
              isFetchingAI={isFetchingAI}
              backfillMessage={backfillMessage}
              isBackfilling={isBackfilling}
              onRefresh={refreshAI}
              onBackfill={handleBackfill}
              onExport={exportCSV}
            />
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 shadow-sm shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Barangay
                  </th>
                  <SortableTh
                    label="Equity Index"
                    active={sortColumn === "equity"}
                    onClick={() => handleSort("equity")}
                  />
                  <SortableTh
                    label="Est. Cost"
                    active={sortColumn === "lifecycleCost"}
                    onClick={() => handleSort("lifecycleCost")}
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
                    label="PM2.5 / yr"
                    active={sortColumn === "pm25KgPerYear"}
                    onClick={() => handleSort("pm25KgPerYear")}
                  />
                  <SortableTh
                    label="PHP / ΔGI"
                    active={sortColumn === "costPerImpact"}
                    onClick={() => handleSort("costPerImpact")}
                  />
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Recommended Intervention
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {filteredData.length > 0
                  ? filteredData.map((row) => {
                      const aiState = aiByName[row.barangay];
                      const isAILoading = aiState?.status === "loading";
                      const aiList: AIRecommendation[] | null =
                        aiState?.status === "ready"
                          ? aiState.recommendations
                          : null;
                      const display = resolveDisplayStrategy(row, aiList);
                      const displayCost = row.lifecycleCost;
                      // lifecycleCost uses estimateCost() matching the explore
                      // sidebar's InfoTab cost card (straight-line maintenance,
                      // treated fraction, 5-year horizon) — unlike costPHP which
                      // uses the engine's NPV-discounted maintenance.
                      const displayImpactGI =
                        display.evalForStrategy.impactGI ?? row.impactGI;
                      const displayCoolingDeltaC =
                        display.evalForStrategy.coolingDeltaC ??
                        row.coolingDeltaC;
                      const displayPM25 =
                        display.evalForStrategy.pm25KgPerYear ??
                        row.pm25KgPerYear;
                      const displayOverallRating =
                        display.aiRec?.overallRating ??
                        display.evalForStrategy.overallRating;
                      const displayCostPerImpact =
                        displayImpactGI > 0
                          ? row.lifecycleCost / displayImpactGI
                          : Number.POSITIVE_INFINITY;
                      let displayStatus: Status;
                      if (displayOverallRating >= 80) displayStatus = "Excellent";
                      else if (displayOverallRating >= 65) displayStatus = "Good";
                      else if (displayOverallRating >= 50) displayStatus = "Fair";
                      else displayStatus = "Poor";

                      return (
                        <TableRow
                          key={row.id}
                          row={row}
                          display={{
                            cost: displayCost,
                            impactGI: displayImpactGI,
                            coolingDeltaC: displayCoolingDeltaC,
                            pm25: displayPM25,
                            overallRating: displayOverallRating,
                            costPerImpact: displayCostPerImpact,
                            status: displayStatus,
                          }}
                          aiRec={display.aiRec}
                          strategy={display.strategy}
                          isAILoading={isAILoading}
                          onSimulate={() => {
                            selectByName(
                              row.barangay,
                              display.strategy,
                              aiList,
                            );
                            setIsSimulationOpen(true);
                          }}
                        />
                      );
                    })
                  : <TableEmptyState onReset={resetFilters} />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <TableFilters
        equityRange={equityRange}
        costRange={costRange}
        tableData={tableData}
        onEquityChange={setEquityRange}
        onCostChange={setCostRange}
        onReset={resetFilters}
      />

      {isSimulationOpen && (
        <SimulationModal
          isOpen={isSimulationOpen}
          setIsOpen={setIsSimulationOpen}
        />
      )}
    </div>
  );
}

// ── Table Row Sub-component ────────────────────────────────────────────────

function TableRow({
  row,
  display,
  aiRec,
  strategy,
  isAILoading,
  onSimulate,
}: {
  row: TableRow;
  display: {
    cost: number;
    impactGI: number;
    coolingDeltaC: number;
    pm25: number;
    overallRating: number;
    costPerImpact: number;
    status: Status;
  };
  aiRec: AIRecommendation | null;
  strategy: InterventionType;
  isAILoading: boolean;
  onSimulate: () => void;
}) {
  const canonicalLabel = STRATEGY_LABELS[strategy].label;
  const headline = aiRec?.name ?? canonicalLabel;
  const tagline = aiRec
    ? aiRec.summary || aiRec.justification
    : row.recommendationTagline;
  const isSynced = !isAILoading;

  const statusPinClass =
    display.status === "Excellent"
      ? "bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400"
      : display.status === "Good"
        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
        : display.status === "Fair"
          ? "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
          : "bg-red-100 dark:bg-red-950/50 text-red-500 dark:text-red-400";

  return (
    <tr className="bg-white dark:bg-neutral-900 hover:bg-green-50/60 dark:hover:bg-green-950/20 transition-colors">
      {/* Barangay name + area + status */}
      <td className="px-5 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${statusPinClass}`}
          >
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 leading-tight">
              {row.barangay}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {row.areaHectares.toFixed(1)} ha
              </span>
              <span className="text-[10px] text-neutral-300 dark:text-neutral-600">
                ·
              </span>
              <span
                className={`text-[11px] font-medium leading-none ${
                  display.status === "Excellent"
                    ? "text-green-600 dark:text-green-400"
                    : display.status === "Good"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : display.status === "Fair"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500 dark:text-red-400"
                }`}
              >
                {display.status}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Equity Index badge */}
      <td className="px-5 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ring-1 ${equityBadgeClass(row.equity)}`}
        >
          {row.equity.toFixed(2)}
        </span>
      </td>

      {/* Cost */}
      <td
        className="px-5 py-4 whitespace-nowrap"
        title={`₱${display.cost.toLocaleString()} — lifecycle cost (capital + maintenance) matching the explore sidebar cost estimate card.`}
      >
        <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums">
          {formatPHP(display.cost)}
        </div>
      </td>

      {/* Impact ΔGI */}
      <td className="px-5 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ring-1 ${impactGiBadgeClass(display.impactGI)}`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          {formatSignedQuantity(display.impactGI, "")}
        </span>
      </td>

      {/* Cooling ΔLST */}
      <td
        className="px-5 py-4 whitespace-nowrap"
        title="Change in Land Surface Temperature — negative is cooling (desirable)."
      >
        <div
          className={`text-sm font-semibold tabular-nums ${
            display.coolingDeltaC < 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {display.coolingDeltaC > 0 ? "+" : ""}
          {display.coolingDeltaC.toFixed(1)}°C
        </div>
      </td>

      {/* PM2.5 / yr */}
      <td
        className="px-5 py-4 whitespace-nowrap"
        title="PM2.5 removed per year by new vegetation (i-Tree Eco)."
      >
        <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums">
          {display.pm25.toFixed(1)} kg
        </div>
      </td>

      {/* PHP / ΔGI */}
      <td className="px-5 py-4 whitespace-nowrap">
        <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 tabular-nums">
          {Number.isFinite(display.costPerImpact)
            ? formatPHP(display.costPerImpact)
            : "—"}
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-4 whitespace-nowrap">
        <StatusBadge status={display.status} />
      </td>

      {/* Recommended Intervention */}
      <td className="px-5 py-3 min-w-[280px]">
        <div className="bg-green-50/40 dark:bg-green-950/15 rounded-xl border border-green-100/60 dark:border-green-900/30 px-3.5 py-2.5">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p
              className="text-sm font-medium text-neutral-800 dark:text-neutral-200 max-w-[220px] truncate font-poppins leading-tight"
              title={headline}
            >
              {headline}
            </p>
            <span
              className="inline-flex items-center justify-center min-w-[28px] h-[22px] rounded-md bg-primary-green/10 dark:bg-primary-green/20 px-1.5 text-[11px] font-bold text-primary-darkgreen dark:text-primary-green"
              title={
                aiRec
                  ? "Composite score — matches the Explore lead card ranking."
                  : "Engine score when AI is unavailable."
              }
            >
              {display.overallRating.toFixed(0)}
            </span>
            {isSynced && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-green-100/60 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
                title="Lead recommendation matches Explore (same RAG API); Simulate opens on the mapped strategy."
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                synced
              </span>
            )}
            {isAILoading && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 dark:text-amber-400">
                <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                syncing…
              </span>
            )}
          </div>
          <p
            className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug line-clamp-2"
            title={tagline}
          >
            {tagline}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              {canonicalLabel}
            </span>
          </div>
        </div>
      </td>

      {/* Simulate button */}
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <button
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#16881b] to-[#4caf50] rounded-lg shadow-sm shadow-green-900/20 hover:shadow-green-900/30 hover:from-[#1a9e20] hover:to-[#5cbf60] active:scale-[0.97] transition-all duration-200 cursor-pointer"
          onClick={onSimulate}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Simulate
        </button>
      </td>
    </tr>
  );
}
