"use client";

import { Activity, CheckCircle2, Circle, Loader2 } from "lucide-react";

export type SimulationLoadingPhase =
  | "baseline"
  | "retrieval"
  | "engine"
  | "narrative"
  | "done";

const PHASE_ORDER: SimulationLoadingPhase[] = [
  "baseline",
  "retrieval",
  "engine",
  "narrative",
  "done",
];

const PHASE_LABEL: Record<SimulationLoadingPhase, string> = {
  baseline: "Reading your barangay's baseline",
  retrieval: "Searching research studies",
  engine: "Modelling metric projections",
  narrative: "Writing explanation and citations",
  done: "Done",
};

type Props = {
  phase: SimulationLoadingPhase;
  /** When true, show a "Skip narrative" CTA next to the narrative phase. */
  canSkipNarrative?: boolean;
  onSkipNarrative?: () => void;
};

const SimulationLoading = ({ phase, canSkipNarrative, onSkipNarrative }: Props) => {
  const currentIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="flex items-center justify-center min-h-[415px]">
      <div className="max-w-xl w-full space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 opacity-20 rounded-full animate-ping" />
            <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full p-8">
              <Activity className="w-12 h-12 text-white animate-pulse" />
            </div>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
            Running grounded simulation
          </h3>
          <p className="text-sm text-gray-600 dark:text-neutral-400">
            Mixing your barangay&apos;s baseline with research-backed coefficients and
            citations from the GreenPoint study library.
          </p>
        </div>

        <ol className="space-y-3">
          {PHASE_ORDER.filter((p) => p !== "done").map((p, idx) => {
            const status =
              idx < currentIdx
                ? "done"
                : idx === currentIdx
                  ? "active"
                  : "pending";
            return (
              <li
                key={p}
                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-neutral-800 px-3 py-2 bg-white dark:bg-neutral-900"
              >
                {status === "done" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : status === "active" ? (
                  <Loader2 className="w-5 h-5 text-emerald-500 shrink-0 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 dark:text-neutral-700 shrink-0" />
                )}
                <span
                  className={
                    status === "pending"
                      ? "text-sm text-gray-400 dark:text-neutral-500"
                      : "text-sm text-gray-800 dark:text-neutral-100"
                  }
                >
                  {PHASE_LABEL[p]}
                </span>
                {p === "narrative" &&
                  status === "active" &&
                  canSkipNarrative && (
                    <button
                      type="button"
                      onClick={onSkipNarrative}
                      className="ml-auto text-xs px-2 py-1 rounded border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                    >
                      Skip narrative
                    </button>
                  )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

export default SimulationLoading;
