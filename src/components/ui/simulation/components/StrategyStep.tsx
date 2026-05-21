"use client";

import { useMemo } from "react";
import { Trees, AlertTriangle, Wand2 } from "lucide-react";
import { STRATEGY_IDS, STRATEGY_LABELS, strategyMismatchReason } from "@/lib/simulation/presets";
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
import { useBarangay } from "@/context/BarangayContext";
import type { InterventionType } from "@/lib/simulation/coefficients";
import type { SimulationBaselineData, SimulationIntent } from "../simulation-types";
import { STRATEGY_ICONS } from "../lib/simulation-input-utils";

export function StrategyStep({
  intent,
  baseline,
  onIntentChange,
}: {
  intent: SimulationIntent;
  baseline: SimulationBaselineData;
  onIntentChange: (partial: Partial<SimulationIntent>) => void;
}) {
  const { simulationBarangay } = useBarangay();
  const ragCards = simulationBarangay?.ragStrategyCards;

  const fallbackIds = useMemo(() => [...STRATEGY_IDS], []);

  const exploreStrategyIds = useMemo(
    () => new Set((ragCards ?? []).map((c) => c.id)),
    [ragCards],
  );

  const additionalStrategyIds = useMemo(
    () => STRATEGY_IDS.filter((id) => !exploreStrategyIds.has(id)),
    [exploreStrategyIds],
  );

  const topExploreId = ragCards?.[0]?.id ?? null;

  // Compute deterministic contextual scores for all canonical strategies.
  const evaluations = useMemo(
    () => evaluateStrategies(baseline),
    [baseline],
  );
  const contextualScores = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ev of evaluations) {
      map[ev.strategy] = ev.overallRating;
    }
    return map;
  }, [evaluations]);

  const scoreColorClass = (score: number) =>
    score >= 75
      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20"
      : score >= 55
        ? "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20"
        : "text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800";

  const renderStrategyCard = (
    id: InterventionType,
    options: {
      headline?: string;
      summary?: string;
      score: number;
      isTopFit?: boolean;
    },
  ) => {
    const meta = STRATEGY_LABELS[id];
    const selected = intent.strategy === id;
    const mismatch = strategyMismatchReason(id, baseline);
    return (
      <button
        key={id}
        type="button"
        aria-pressed={selected}
        onClick={() => onIntentChange({ strategy: id })}
        className={`text-left rounded-xl border-2 p-4 transition-all relative ${
          selected
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-sm"
            : mismatch
              ? "border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 opacity-70 hover:opacity-100"
              : "border-gray-200 dark:border-neutral-800 hover:border-emerald-300 bg-white dark:bg-neutral-900"
        }`}
      >
        <span className="absolute top-2 right-2 flex items-center gap-1.5">
          {options.isTopFit && !selected && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded"
              title="Lead recommendation — first card in Explore for this site."
            >
              <Wand2 className="w-3 h-3" />
              Top fit
            </span>
          )}
          <span
            className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded ${scoreColorClass(options.score)}`}
            title="Composite 0–100 rating from the same Explore / RAG response."
          >
            {options.score.toFixed(0)}
          </span>
        </span>
        <div className="flex items-start gap-3">
          <span className="rounded-lg p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            {STRATEGY_ICONS[id]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800 dark:text-neutral-100 pr-16">
              {options.headline ?? meta.label}
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500 mt-0.5">
              {meta.label}
            </p>
            <p className="text-sm text-gray-600 dark:text-neutral-400 mt-0.5">
              {options.summary ?? meta.tagline}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {meta.badges.map((b) => (
                <span
                  key={b}
                  className="text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                >
                  best for {b}
                </span>
              ))}
            </div>
            {mismatch && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{mismatch}</span>
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Trees className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Pick a greening strategy</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-neutral-400">
          {ragCards?.length ? (
            <>
              First cards match your <strong>Explore</strong> RAG run for{" "}
              <strong>{baseline.name ?? "this barangay"}</strong> (same order
              and <strong>0–100</strong> scores as the map sidebar). Additional
              canonical strategies follow <strong>without</strong> scores so you
              can still model any option.
            </>
          ) : (
            <>
              All canonical strategies are listed for{" "}
              <strong>{baseline.name ?? "this barangay"}</strong>. Open{" "}
              <strong>Simulate</strong> from the intervention table after AI
              recommendations finish loading to sync this step with Explore, or
              choose any strategy below. Cards may be greyed out when a strategy
              is a weak fit for the baseline.
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ragCards?.length ? (
          <>
            {ragCards.map((card, idx) =>
              renderStrategyCard(card.id, {
                headline: card.headline,
                summary: card.summary,
                score: card.overallRating,
                isTopFit: card.id === topExploreId && idx === 0,
              }),
            )}
            {additionalStrategyIds.map((id) =>
              renderStrategyCard(id, {
                score: contextualScores[id] ?? 0,
              }),
            )}
          </>
        ) : (
          fallbackIds.map((id) =>
            renderStrategyCard(id, {
              score: contextualScores[id] ?? 0,
            }),
          )
        )}
      </div>
    </section>
  );
}
