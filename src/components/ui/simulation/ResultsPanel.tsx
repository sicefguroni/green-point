"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Info,
  Quote,
  TrendingUp,
} from "lucide-react";
import {
  formatCompact,
  formatPHP,
  formatSignedQuantity,
} from "@/lib/format-number";
import type {
  AreaAggregate,
  MetricEstimate,
  MetricKey,
  SimulationBaselineData,
  SimulationNarrative,
  SimulationResultsState,
} from "./simulation-types";

const METRIC_DESCRIPTION: Record<MetricKey, string> = {
  lst:
    "Land Surface Temperature. Lower is better. Heat reduction comes from canopy shade and evapotranspiration.",
  ndvi:
    "Normalized Difference Vegetation Index. Higher means greener / more vigorous vegetation as seen from satellite.",
  canopy:
    "Tree canopy cover percentage of the barangay area. Direct measure of greening.",
  gi:
    "Composite Greenery Index combining vegetation quantity and environmental quality.",
  stormwater:
    "Annual stormwater retained at source by greening. Reduces downstream flood load.",
  pm25:
    "Annual PM2.5 (fine particulate) removal by canopy and groundcover.",
  no2: "Annual NO₂ uptake by canopy and groundcover.",
  co2:
    "Annual CO₂ sequestered by new biomass. Long-term — most of this is realised after maturity.",
};

function formatMetricValue(n: number, unit: string): string {
  if (unit === "PHP") return formatPHP(n);
  if (Math.abs(n) >= 1_000) return formatCompact(n);
  if (unit === "" || unit === "%") return Number(n.toFixed(3)).toString();
  return Number(n.toFixed(2)).toString();
}

function MetricCard({
  metric,
  citations,
  showBaseline,
}: {
  metric: MetricEstimate;
  citations?: SimulationNarrative["metricCitations"][MetricKey];
  showBaseline: boolean;
}) {
  const goodDirection = metric.direction === "down-good"
    ? metric.delta < 0
    : metric.delta > 0;
  const tone = goodDirection
    ? "from-emerald-50 to-emerald-100/60 border-emerald-200 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/30"
    : "from-amber-50 to-amber-100/60 border-amber-200 dark:from-amber-500/10 dark:to-amber-500/5 dark:border-amber-500/30";
  const ArrowIcon = goodDirection ? ArrowUpRight : ArrowDownRight;
  const arrowTone = goodDirection
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-amber-700 dark:text-amber-300";
  const [popoverOpen, setPopoverOpen] = useState(false);
  return (
    <div
      className={`relative bg-gradient-to-br ${tone} border rounded-xl p-4 flex flex-col gap-1.5`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-neutral-300 uppercase tracking-wide">
          {metric.label}
        </span>
        <button
          type="button"
          aria-label={`More about ${metric.label}`}
          onClick={() => setPopoverOpen((v) => !v)}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-neutral-100"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        className="flex items-baseline gap-1.5 truncate"
        title={`${metric.projected}${metric.unit ? " " + metric.unit : ""}`}
      >
        <span className="text-2xl font-bold text-gray-900 dark:text-neutral-50 truncate">
          {formatMetricValue(metric.projected, metric.unit)}
        </span>
        <span className="text-xs text-gray-500 dark:text-neutral-400 shrink-0">
          {metric.unit}
        </span>
      </div>
      <div className={`text-xs flex items-center gap-1 ${arrowTone}`}>
        <ArrowIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate" title={`${metric.delta} ${metric.unit}`}>
          {formatSignedQuantity(metric.delta, metric.unit)}
        </span>
      </div>
      <div className="text-[11px] text-gray-500 dark:text-neutral-400">
        Range {formatMetricValue(metric.low, metric.unit)}–
        {formatMetricValue(metric.high, metric.unit)}
      </div>
      {showBaseline && (
        <div className="text-[11px] text-gray-500 dark:text-neutral-400 border-t border-black/5 dark:border-white/5 pt-1.5 mt-1.5">
          Baseline: {formatMetricValue(metric.baseline, metric.unit)}{" "}
          {metric.unit}
        </div>
      )}
      {metric.note && (
        <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{metric.note}</span>
        </div>
      )}
      {popoverOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-10 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-3 shadow-lg text-xs space-y-2">
          <p className="text-gray-700 dark:text-neutral-300">
            {METRIC_DESCRIPTION[metric.key]}
          </p>
          {citations && citations.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-neutral-500 font-semibold">
                Cited from research
              </div>
              {citations.slice(0, 2).map((c, i) => (
                <div key={i} className="border-l-2 border-emerald-300 pl-2">
                  <div className="font-medium text-gray-800 dark:text-neutral-200">
                    {c.studyTitle}
                  </div>
                  {c.excerpt && (
                    <div className="text-gray-600 dark:text-neutral-400 italic flex items-start gap-1">
                      <Quote className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{c.excerpt}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 dark:text-neutral-500 italic">
              No specific study citation matched. Engine value is from literature
              ranges in the coefficients table.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AggregateRow({ row }: { row: AreaAggregate }) {
  const display =
    row.unit === "PHP"
      ? formatPHP(row.value).replace(/^₱/, "")
      : formatCompact(row.value);
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-gray-200 dark:border-neutral-800 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-gray-700 dark:text-neutral-300">
          {row.label}
        </div>
        {row.note && (
          <div className="text-[11px] text-gray-500 dark:text-neutral-500">
            {row.note}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div
          className="text-base font-semibold text-gray-900 dark:text-neutral-50 tabular-nums"
          title={`${row.value.toLocaleString()} ${row.unit}`}
        >
          {row.unit === "PHP" && "₱"}
          {display}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-neutral-500">
          {row.unit}
        </div>
      </div>
    </div>
  );
}

const SENSITIVITY_LABELS: Record<string, string> = {
  canopy_target_percent: "Canopy target",
  ndvi_target: "NDVI target",
  temperature_increase_rate: "Climate warming",
  rainfall_change_rate: "Rainfall change",
  total_budget_cap: "Budget cap",
  cost_per_sqm: "Cost per m²",
  time_horizon: "Time horizon",
};

const SimulationResults = ({
  results,
  baseline,
}: {
  results: SimulationResultsState;
  baseline: SimulationBaselineData;
}) => {
  const { estimates, narrative, meta } = results;
  const [showBaseline, setShowBaseline] = useState(false);

  const finalGiClass =
    estimates.finalGI.gi_level === "Excellent"
      ? "text-emerald-600 dark:text-emerald-300"
      : estimates.finalGI.gi_level === "High"
        ? "text-green-600 dark:text-green-300"
        : estimates.finalGI.gi_level === "Medium"
          ? "text-yellow-600 dark:text-yellow-300"
          : "text-orange-600 dark:text-orange-300";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">
            Final Greenery Index
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className={`text-4xl font-bold ${finalGiClass}`}>
              {estimates.finalGI.gi_score}
            </span>
            <span className={`text-lg font-semibold ${finalGiClass}`}>
              {estimates.finalGI.gi_level}
            </span>
          </div>
          <div className="text-xs text-gray-600 dark:text-neutral-400 mt-1">
            For{" "}
            <strong>{baseline.name ?? "this barangay"}</strong> ·{" "}
            {(baseline.areaHectares ?? 0).toFixed(1)} ha
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {estimates.costProjection.budgetBinding && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
              <AlertTriangle className="w-3 h-3" />
              Budget binding
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-white/70 dark:bg-neutral-900/60 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-800"
            title={`₱${estimates.costProjection.totalPHP.toLocaleString()}`}
          >
            {formatPHP(estimates.costProjection.totalPHP)} programme cost
          </span>
          <button
            onClick={() => setShowBaseline((v) => !v)}
            className="text-xs px-2 py-1 rounded-full border border-emerald-300 text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/10"
          >
            {showBaseline ? "Hide baseline" : "Compare to baseline"}
          </button>
        </div>
      </section>

      {estimates.warnings.length > 0 && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Engine warnings
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200 list-disc list-inside">
            {estimates.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100 mb-3">
          Per-metric projections
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {estimates.metrics.map((m) => (
            <MetricCard
              key={m.key}
              metric={m}
              citations={narrative?.metricCitations?.[m.key]}
              showBaseline={showBaseline}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-neutral-100 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          Greenery Index evolution
        </h3>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={estimates.giEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.2)" />
              <XAxis
                dataKey="year"
                label={{ value: "Year", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                domain={[0, 1]}
                label={{ value: "Score", angle: -90, position: "insideLeft" }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="gi_score"
                stroke="#10b981"
                strokeWidth={3}
                name="GI Score"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="quantity_score"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Quantity"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="environmental_quality_score"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Env. Quality"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100 mb-2">
            Barangay-total impact
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mb-2">
            Aggregate values across the {baseline.areaHectares?.toFixed(1) ?? "—"}{" "}
            ha of {baseline.name ?? "this barangay"} for the chosen scenario.
          </p>
          <div className="space-y-0">
            {estimates.barangayTotals.map((row) => (
              <AggregateRow key={row.key} row={row} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100 mb-2">
            What drives the outcome (sensitivity)
          </h3>
          {estimates.sensitivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={estimates.sensitivity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.2)" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="input"
                  width={140}
                  tickFormatter={(k: string) => SENSITIVITY_LABELS[k] ?? k}
                />
                <Tooltip
                  formatter={(v: number) => v.toFixed(4)}
                  labelFormatter={(k: string) =>
                    SENSITIVITY_LABELS[k] ?? k
                  }
                />
                <Bar dataKey="contribution" fill="#10b981">
                  {estimates.sensitivity.map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Inputs all contribute roughly equally — no dominant lever.
            </p>
          )}
          {narrative?.sensitivityNarrative && (
            <p className="mt-2 text-sm text-gray-700 dark:text-neutral-300">
              {narrative.sensitivityNarrative}
            </p>
          )}
        </div>
      </section>

      {narrative ? (
        <>
          <section className="rounded-xl border-2 border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/70 to-teal-50/70 dark:from-emerald-500/5 dark:to-teal-500/5 p-5">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm uppercase tracking-wide">
              <CheckCircle2 className="w-4 h-4" />
              Why this works here
            </div>
            <p className="mt-2 text-gray-800 dark:text-neutral-100 leading-relaxed">
              {narrative.effectivenessRationale}
            </p>
          </section>

          {narrative.shortcomings.length > 0 && (
            <section className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/5 p-5">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4" />
                Shortcomings &amp; caveats
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-amber-900 dark:text-amber-200 list-disc list-inside">
                {narrative.shortcomings.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {narrative.alternativeStrategy && (
            <section className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/5 p-5">
              <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300 font-semibold">
                Alternative to consider
              </div>
              <div className="mt-1 text-base font-semibold text-gray-800 dark:text-neutral-100">
                {narrative.alternativeStrategy.name}
              </div>
              <p className="text-sm text-gray-700 dark:text-neutral-300 mt-1">
                {narrative.alternativeStrategy.reason}
              </p>
            </section>
          )}

          {narrative.citedStudies.length > 0 && (
            <section className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <h3 className="text-base font-semibold text-gray-800 dark:text-neutral-100 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                Cited studies ({narrative.citedStudies.length})
              </h3>
              <ul className="space-y-1.5 text-sm">
                {narrative.citedStudies.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="text-gray-800 dark:text-neutral-100">
                      {s.studyTitle}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-neutral-500 tabular-nums shrink-0">
                      similarity {s.similarity.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 text-sm text-gray-600 dark:text-neutral-400">
          {meta.narrativeError ? (
            <>
              <div className="font-semibold text-gray-800 dark:text-neutral-200 mb-1">
                Narrative unavailable
              </div>
              <p>{meta.narrativeError}</p>
            </>
          ) : (
            <p>Narrative skipped. Engine results shown above.</p>
          )}
        </section>
      )}
    </div>
  );
};

export default SimulationResults;
