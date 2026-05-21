"use client";

import {
  ArrowUpDown,
  Sparkles,
  CheckCircle2,
  Download,
  BrainCircuit,
  RefreshCw,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatPHP } from "@/lib/format-number";
import { STATUS_BADGE_STYLES } from "./dashboard-table-utils";
import type { Status } from "./dashboard-table-types";

// ─── Sortable Header Cell ──────────────────────────────────────────────────

export function SortableTh({
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
      className="px-5 py-3.5 text-left text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest cursor-pointer hover:bg-green-50/60 dark:hover:bg-green-950/30 transition-all duration-150 select-none group"
    >
      <div className="flex items-center gap-1.5">
        <span
          className={
            active
              ? "text-neutral-700 dark:text-neutral-200"
              : "group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors"
          }
        >
          {label}
        </span>
        <ArrowUpDown
          className={`w-3 h-3 transition-all duration-200 ${
            active
              ? "text-primary-green dark:text-green-400 opacity-100"
              : "text-neutral-400 dark:text-neutral-500 opacity-0 group-hover:opacity-60"
          }`}
        />
      </div>
    </th>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_BADGE_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full ring-1 ${s.bg} ${s.text} ${s.ring}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ─── Range Control Slider ──────────────────────────────────────────────────

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
  const accentClass =
    accent === "green"
      ? "[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-green-400 [&_[data-slot=slider-range]]:to-green-600 [&_[data-slot=slider-thumb]]:border-green-500 [&_[data-slot=slider-thumb]]:ring-green-500/30"
      : "[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-emerald-400 [&_[data-slot=slider-range]]:to-emerald-600 [&_[data-slot=slider-thumb]]:border-emerald-500 [&_[data-slot=slider-thumb]]:ring-emerald-500/30";

  return (
    <div className="bg-neutral-50/60 dark:bg-neutral-950/30 rounded-xl p-4 border border-neutral-100 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-4">
        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 font-poppins">
          {label}
        </label>
        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 tabular-nums bg-white dark:bg-neutral-900 px-2.5 py-0.5 rounded-md ring-1 ring-neutral-200 dark:ring-neutral-700">
          {formatValue(value[0])} – {formatValue(value[1])}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onChange}
        className={`w-full [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-neutral-200 dark:[&_[data-slot=slider-track]]:bg-neutral-700 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:shadow-md ${accentClass}`}
      />
      <div className="flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500 font-medium mt-2">
        <span>{footerLabels[0]}</span>
        <span>{footerLabels[1]}</span>
      </div>
    </div>
  );
}

// ─── Empty Table State ─────────────────────────────────────────────────────

export function TableEmptyState({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <tr>
      <td colSpan={10} className="px-6 py-16 text-center">
        <div className="max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-neutral-400 dark:text-neutral-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3c-1.657 0-3 .895-3 2v1m6 4v1m0 0v1m0-2a3 3 0 00-6 0"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-neutral-600 dark:text-neutral-300 font-poppins">
            No barangays match your filters
          </p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1.5 leading-relaxed">
            Try adjusting the range sliders below or reset filters
          </p>
          <button
            onClick={onReset}
            className="mt-4 px-4 py-2 text-xs font-semibold text-primary-green dark:text-green-400 bg-primary-green/10 dark:bg-green-900/30 rounded-full hover:bg-primary-green/20 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Table Action Buttons ──────────────────────────────────────────────────

export function TableActionButtons({
  isFetchingAI,
  backfillMessage,
  isBackfilling,
  onRefresh,
  onBackfill,
  onExport,
}: {
  isFetchingAI: boolean;
  backfillMessage: string | null;
  isBackfilling: boolean;
  onRefresh: () => void;
  onBackfill: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap shrink-0">
      {isFetchingAI && (
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-white/20 px-2.5 py-1 rounded-full border border-white/25"
          title="Pulling fresh interventions for every barangay."
        >
          <Sparkles className="w-3 h-3 animate-pulse" />
          Syncing…
        </span>
      )}
      {backfillMessage && (
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-white/15 px-2.5 py-1 rounded-full border border-white/25 max-w-[260px] truncate"
          title={backfillMessage}
        >
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          {backfillMessage}
        </span>
      )}
      <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
        Source: ESA / NASA / NOAH
      </span>
      <button
        onClick={onRefresh}
        disabled={isFetchingAI}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-white/15 border border-white/25 rounded-full hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all duration-200"
        title="Re-run the recommendations pipeline for every barangay."
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isFetchingAI ? "animate-spin" : ""}`}
        />
        Refresh
      </button>
      <button
        onClick={onBackfill}
        disabled={isBackfilling}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-white/15 border border-white/25 rounded-full hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all duration-200"
        title="Run AI/RAG pipeline for all barangays and cache results in the database."
      >
        <BrainCircuit
          className={`w-3.5 h-3.5 ${isBackfilling ? "animate-pulse" : ""}`}
        />
        {isBackfilling ? "Generating…" : "Generate all"}
      </button>
      <button
        onClick={onExport}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-white/15 border border-white/25 rounded-full hover:bg-white/25 flex items-center gap-1.5 transition-all duration-200"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
    </div>
  );
}

// ─── Filter Panel ──────────────────────────────────────────────────────────

export function TableFilters({
  equityRange,
  costRange,
  tableData,
  onEquityChange,
  onCostChange,
  onReset,
}: {
  equityRange: number[];
  costRange: number[];
  tableData: { costPHP: number }[];
  onEquityChange: (v: number[]) => void;
  onCostChange: (v: number[]) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 shadow-sm shadow-black/5 dark:shadow-black/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#16881b] to-[#4caf50] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 font-poppins">
                Weighting Scenario
              </h3>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                Filter by Equity Index and Cost range
              </p>
            </div>
          </div>
          <button
            className="px-3 py-1.5 text-[11px] font-semibold text-primary-green dark:text-green-400 bg-primary-green/10 dark:bg-green-900/30 rounded-full hover:bg-primary-green/20 transition-colors"
            onClick={onReset}
          >
            Reset Filters
          </button>
        </div>
      </div>
      <div className="p-5">
        <div className="grid md:grid-cols-2 gap-6">
          <RangeControl
            label="Equity Index"
            accent="green"
            min={0}
            max={1}
            step={0.01}
            value={equityRange}
            onChange={onEquityChange}
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
            onChange={onCostChange}
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
    </div>
  );
}
