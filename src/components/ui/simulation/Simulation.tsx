"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  X,
  Play,
  ThermometerSun,
  Leaf,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import SimulationInputs, {
  type SimulationStepId,
} from "./InputsPanel";
import SimulationResults from "./ResultsPanel";
import SimulationLoading, { type SimulationLoadingPhase } from "./Loading";
import { useBarangay } from "@/context/BarangayContext";
import { useLivePreview } from "./useLivePreview";
import { formatPHP } from "@/lib/format-number";
import {
  defaultClimateFromBaseline,
  resolveIntent,
  suggestStrategy,
} from "@/lib/simulation/presets";
import type { InterventionType } from "@/lib/simulation/coefficients";
import type {
  SimulationBaselineData,
  SimulationInputsState,
  SimulationIntent,
  SimulationResultsState,
} from "./simulation-types";

const STEPS: { id: SimulationStepId; label: string }[] = [
  { id: "climate", label: "Climate" },
  { id: "strategy", label: "Strategy" },
  { id: "ambitionBudget", label: "Ambition & Budget" },
  { id: "review", label: "Review" },
];

function buildBaseline(
  raw: ReturnType<typeof useBarangay>["simulationBarangay"],
): SimulationBaselineData {
  return {
    name: raw?.name,
    ndvi: raw?.ndvi ?? 0.42,
    lst: raw?.lst ?? 32.5,
    floodExposure: raw?.floodExposure ?? "Medium",
    greeneryIndex: raw?.greeneryIndex ?? 0.58,
    canopyCover: raw?.treeCanopy ?? 28,
    currentIntervention: raw?.currentIntervention ?? "Urban Canopy Enhancement",
    areaHectares: raw?.areaHectares,
  };
}

function defaultIntent(baseline: SimulationBaselineData): SimulationIntent {
  return {
    climateFuture: defaultClimateFromBaseline(baseline),
    strategy: suggestStrategy(baseline) as InterventionType,
    ambition: "moderate",
    budgetTier: "medium",
    timeHorizon: 5,
  };
}

const SimulationModal = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) => {
  const { simulationBarangay } = useBarangay();
  const baseline = useMemo(
    () => buildBaseline(simulationBarangay),
    [simulationBarangay],
  );

  const [stage, setStage] = useState<"setup" | "loading" | "results">("setup");
  const [stepIdx, setStepIdx] = useState(0);
  const [intent, setIntent] = useState<SimulationIntent>(() =>
    defaultIntent(baseline),
  );
  const [advancedOverrides, setAdvancedOverrides] = useState<
    Partial<SimulationInputsState>
  >({});
  const [loadingPhase, setLoadingPhase] = useState<SimulationLoadingPhase>(
    "baseline",
  );
  const [results, setResults] = useState<SimulationResultsState | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const skipRef = useRef(false);

  const inputs: SimulationInputsState = useMemo(
    () => ({ ...resolveIntent(intent, baseline), ...advancedOverrides }),
    [intent, baseline, advancedOverrides],
  );

  // Keep intent default in sync when the user opens the modal for a new barangay.
  useEffect(() => {
    if (isOpen) {
      setIntent(defaultIntent(baseline));
      setAdvancedOverrides({});
      setStage("setup");
      setStepIdx(0);
      setResults(null);
      setRunError(null);
      skipRef.current = false;
    }
  }, [isOpen, baseline]);

  const livePreview = useLivePreview(inputs, baseline);

  const closeModal = () => {
    setIsOpen(false);
  };

  const handleIntentChange = (partial: Partial<SimulationIntent>) =>
    setIntent((prev) => ({ ...prev, ...partial }));

  const handleAdvancedChange = <K extends keyof SimulationInputsState>(
    key: K,
    value: SimulationInputsState[K],
  ) => setAdvancedOverrides((prev) => ({ ...prev, [key]: value }));

  const next = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const back = () => setStepIdx((i) => Math.max(0, i - 1));

  const runSimulation = async () => {
    setStage("loading");
    setLoadingPhase("baseline");
    setRunError(null);
    skipRef.current = false;

    setTimeout(() => setLoadingPhase("retrieval"), 300);
    setTimeout(() => setLoadingPhase("engine"), 1200);
    setTimeout(() => setLoadingPhase("narrative"), 2200);

    try {
      const res = await fetch("/api/simulation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, baseline }),
      });
      const json = (await res.json()) as
        | { success: true; data: SimulationResultsState }
        | { success: false; error: string };
      if (!json.success) {
        if (skipRef.current) return;
        throw new Error(json.error);
      }
      if (skipRef.current) return;
      setResults(json.data);
      setLoadingPhase("done");
      setStage("results");
    } catch (err) {
      if (skipRef.current) return;
      console.error("Simulation run failed:", err);
      setRunError(
        err instanceof Error
          ? err.message
          : "Failed to run simulation. Please try again.",
      );
      setStage("setup");
    }
  };

  const handleSkipNarrative = () => {
    skipRef.current = true;
    setResults({
      estimates: livePreview,
      narrative: null,
      meta: { retrievedChunks: 0, query: "Skipped narrative" },
    });
    setLoadingPhase("done");
    setStage("results");
  };

  const exportReport = () => {
    if (!results) return;
    const report = {
      timestamp: new Date().toISOString(),
      intent,
      inputs,
      baseline,
      results,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => window.print();

  if (!isOpen) return null;

  const currentStep = STEPS[stepIdx];
  const isLastStep = stepIdx === STEPS.length - 1;
  const progressPct = ((stepIdx + 1) / STEPS.length) * 100;

  const lstMetric = livePreview.metrics.find((m) => m.key === "lst");
  const giMetric = livePreview.metrics.find((m) => m.key === "gi");
  const cost = livePreview.costProjection.totalPHP;
  const budgetBinding = livePreview.costProjection.budgetBinding;

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 print:static print:bg-transparent print:p-0"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col print:max-h-none print:rounded-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 print:bg-white print:text-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold truncate">
                Greening Simulation
              </h2>
              <p className="text-emerald-100 dark:text-emerald-100 mt-0.5 text-sm truncate print:text-gray-600">
                {baseline.name ?? "Selected barangay"} ·{" "}
                {(baseline.areaHectares ?? 0).toFixed(1)} ha ·{" "}
                {stage === "setup"
                  ? `Step ${stepIdx + 1} of ${STEPS.length}: ${currentStep.label}`
                  : stage === "loading"
                    ? "Running grounded simulation"
                    : "Projected outcomes and recommendations"}
              </p>
            </div>
            <button
              onClick={closeModal}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors print:hidden"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {stage === "setup" && (
            <div className="mt-3 print:hidden">
              <ol className="grid grid-cols-4 gap-1.5 text-[11px] uppercase tracking-wide">
                {STEPS.map((s, i) => {
                  const done = i < stepIdx;
                  const active = i === stepIdx;
                  return (
                    <li
                      key={s.id}
                      className={`rounded-md px-2 py-1.5 flex items-center justify-center transition-colors ${
                        done
                          ? "bg-white/30 text-white"
                          : active
                            ? "bg-white text-emerald-700 font-semibold shadow-sm"
                            : "bg-white/10 text-white/70"
                      }`}
                    >
                      {i + 1}. {s.label}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 h-1 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
          {runError && stage === "setup" && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{runError}</span>
            </div>
          )}
          {stage === "setup" && (
            <SimulationInputs
              step={currentStep.id}
              intent={intent}
              inputs={inputs}
              baseline={baseline}
              onIntentChange={handleIntentChange}
              onAdvancedChange={handleAdvancedChange}
            />
          )}
          {stage === "loading" && (
            <SimulationLoading
              phase={loadingPhase}
              canSkipNarrative={loadingPhase === "narrative"}
              onSkipNarrative={handleSkipNarrative}
            />
          )}
          {stage === "results" && results && (
            <SimulationResults results={results} baseline={baseline} />
          )}
        </main>

        <footer className="border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 px-4 md:px-6 py-3 print:hidden">
          {stage === "setup" ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <PreviewChip
                  icon={<ThermometerSun className="w-3.5 h-3.5" />}
                  label="ΔLST"
                  value={lstMetric ? `${lstMetric.delta.toFixed(2)}°C` : "—"}
                  good={lstMetric ? lstMetric.delta < 0 : false}
                />
                <PreviewChip
                  icon={<Leaf className="w-3.5 h-3.5" />}
                  label="Final GI"
                  value={giMetric ? giMetric.projected.toFixed(2) : "—"}
                  good={giMetric ? giMetric.delta > 0 : false}
                />
                <PreviewChip
                  icon={<Wallet className="w-3.5 h-3.5" />}
                  label="Est. cost"
                  value={formatPHP(cost)}
                  title={`₱${cost.toLocaleString()}`}
                  warn={budgetBinding}
                />
                {budgetBinding && (
                  <span className="text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Budget binds the canopy target
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={back}
                  disabled={stepIdx === 0}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                {!isLastStep ? (
                  <button
                    onClick={next}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 text-sm"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={runSimulation}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 text-sm"
                  >
                    <Play className="w-4 h-4" />
                    Run simulation
                  </button>
                )}
              </div>
            </div>
          ) : stage === "results" ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStage("setup")}
                className="border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 px-3 py-2 rounded-lg font-medium flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to inputs
              </button>
              <div className="flex gap-2">
                <button
                  onClick={printReport}
                  className="border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 px-3 py-2 rounded-lg font-medium text-sm"
                >
                  Print PDF
                </button>
                <button
                  onClick={exportReport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
              </div>
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

function PreviewChip({
  icon,
  label,
  value,
  good,
  warn,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  good?: boolean;
  warn?: boolean;
  title?: string;
}) {
  const tone = warn
    ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
    : good
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30"
      : "border-gray-200 bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${tone}`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
      <strong className="text-xs font-semibold">{value}</strong>
    </span>
  );
}

export default SimulationModal;
