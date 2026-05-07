"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileDown,
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
import { evaluateStrategies } from "@/lib/simulation/evaluate-strategies";
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

/**
 * Defaults here MUST stay aligned with `featureToBaseline` in
 * `InterventionAnalysisTable.tsx`, otherwise the dashboard's recommended
 * intervention will diverge from the simulation's strategy step for any row
 * that arrives with missing properties.
 */
function buildBaseline(
  raw: ReturnType<typeof useBarangay>["simulationBarangay"],
): SimulationBaselineData {
  return {
    name: raw?.name,
    ndvi: raw?.ndvi ?? 0.4,
    lst: raw?.lst ?? 32,
    floodExposure: raw?.floodExposure ?? "Low",
    greeneryIndex: raw?.greeneryIndex ?? 0.5,
    canopyCover: raw?.treeCanopy ?? 45,
    currentIntervention: raw?.currentIntervention ?? "None",
    areaHectares: raw?.areaHectares,
  };
}

/**
 * Pick the strategy the simulation modal should open on. Priority order:
 *   1. The `recommendedStrategy` the dashboard handed in via context — this
 *      is the AI-driven pick the user just clicked "Simulate" on, so the
 *      modal must preselect *exactly* that intervention.
 *   2. The deterministic ranker's top pick, which matches the strategy step's
 *      "Top fit" badge.
 *   3. The lightweight `suggestStrategy` heuristic as a final fallback.
 */
function defaultIntent(
  baseline: SimulationBaselineData,
  recommendedStrategy?: string,
): SimulationIntent {
  let strategy: InterventionType;
  if (recommendedStrategy && isInterventionType(recommendedStrategy)) {
    strategy = recommendedStrategy;
  } else {
    try {
      strategy =
        evaluateStrategies(baseline)[0]?.strategy ?? suggestStrategy(baseline);
    } catch {
      strategy = suggestStrategy(baseline) as InterventionType;
    }
  }
  return {
    climateFuture: defaultClimateFromBaseline(baseline),
    strategy,
    ambition: "moderate",
    budgetTier: "medium",
    timeHorizon: 5,
  };
}

const VALID_INTERVENTION_TYPES: ReadonlySet<string> = new Set([
  "urban canopy",
  "targeted infill",
  "understory shrubs",
  "green roof",
  "vertical greening",
  "green corridor",
  "pocket park",
  "rain garden",
  "permeable surface",
  "riparian buffer",
]);

function isInterventionType(value: string): value is InterventionType {
  return VALID_INTERVENTION_TYPES.has(value);
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

  const recommendedStrategy = simulationBarangay?.recommendedStrategy;

  const [stage, setStage] = useState<"setup" | "loading" | "results">("setup");
  const [stepIdx, setStepIdx] = useState(0);
  const [intent, setIntent] = useState<SimulationIntent>(() =>
    defaultIntent(baseline, recommendedStrategy),
  );
  const [advancedOverrides, setAdvancedOverrides] = useState<
    Partial<SimulationInputsState>
  >({});
  const [loadingPhase, setLoadingPhase] = useState<SimulationLoadingPhase>(
    "baseline",
  );
  const [results, setResults] = useState<SimulationResultsState | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const skipRef = useRef(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const inputs: SimulationInputsState = useMemo(
    () => ({ ...resolveIntent(intent, baseline), ...advancedOverrides }),
    [intent, baseline, advancedOverrides],
  );

  // Keep intent default in sync when the user opens the modal for a new barangay.
  useEffect(() => {
    if (isOpen) {
      setIntent(defaultIntent(baseline, recommendedStrategy));
      setAdvancedOverrides({});
      setStage("setup");
      setStepIdx(0);
      setResults(null);
      setRunError(null);
      skipRef.current = false;
    }
  }, [isOpen, baseline, recommendedStrategy]);

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

  /**
   * Export the rendered results panel to a multi-page A4 PDF using
   * html2canvas + jsPDF. We dynamically import both libraries so they
   * stay out of the main client bundle.
   */
  const exportPDF = async () => {
    if (!results || !reportRef.current) return;
    setIsExportingPDF(true);
    try {
      // html2canvas-pro is the maintained fork with native support for
      // modern color functions (oklch, lab, lch, color()) emitted by
      // Tailwind v4. The original html2canvas v1.4 fails to parse oklch.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const node = reportRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: node.scrollWidth,
      });

      const pdf = new jsPDF({
        unit: "pt",
        format: "a4",
        orientation: "portrait",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 32;
      const contentWidth = pageWidth - margin * 2;
      const ratio = canvas.width / contentWidth;
      const imgHeight = canvas.height / ratio;

      // Cover header drawn with vector text so it stays crisp.
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, 0, pageWidth, 56, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("GreenPoint Simulation Report", margin, 28);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(
        `${baseline.name ?? "Selected barangay"} · ${(baseline.areaHectares ?? 0).toFixed(1)} ha · Generated ${new Date().toLocaleString()}`,
        margin,
        46,
      );

      // Slice the canvas across pages so tall reports paginate cleanly.
      const headerOffset = 72;
      let position = headerOffset;
      let remaining = imgHeight;
      const imgData = canvas.toDataURL("image/png");

      pdf.addImage(
        imgData,
        "PNG",
        margin,
        position,
        contentWidth,
        imgHeight,
        undefined,
        "FAST",
      );
      remaining -= pageHeight - position - margin;
      while (remaining > 0) {
        pdf.addPage();
        position = -(imgHeight - remaining) + margin;
        pdf.addImage(
          imgData,
          "PNG",
          margin,
          position,
          contentWidth,
          imgHeight,
          undefined,
          "FAST",
        );
        remaining -= pageHeight - margin * 2;
      }

      // Footer page numbers.
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(9);
        pdf.text(
          `Page ${p} of ${totalPages}`,
          pageWidth - margin,
          pageHeight - 16,
          { align: "right" },
        );
        pdf.text("greenpoint.app", margin, pageHeight - 16);
      }

      const safeName = (baseline.name ?? "barangay")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      pdf.save(`greenpoint-simulation-${safeName}-${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      setRunError(
        err instanceof Error
          ? `PDF export failed: ${err.message}`
          : "PDF export failed.",
      );
    } finally {
      setIsExportingPDF(false);
    }
  };

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
            <div ref={reportRef} className="bg-white dark:bg-neutral-900">
              <SimulationResults
                results={results}
                baseline={baseline}
                inputs={inputs}
              />
            </div>
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
                  onClick={exportReport}
                  className="border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 px-3 py-2 rounded-lg font-medium flex items-center gap-2 text-sm"
                  title="Export the raw scenario, inputs, and engine results as JSON."
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
                <button
                  onClick={exportPDF}
                  disabled={isExportingPDF}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 text-sm"
                  title="Save a multi-page PDF of this simulation report."
                >
                  <FileDown className="w-4 h-4" />
                  {isExportingPDF ? "Exporting…" : "Export PDF"}
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
