"use client";

import { Sparkles, BarChart2 } from "lucide-react";

interface IndicatorInfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  source?: string;
  frequency?: string;
}

export default function IndicatorInfoModal({
  open,
  onClose,
  title,
  description,
  source,
  frequency,
}: IndicatorInfoModalProps) {
  if (!open) return null;
  const parts = description ? description.split("\n\n") : [];
  const what = parts[0];
  const why = parts[1];
  const defaultWhat =
    "A measurable environmental metric for a barangay (e.g., tree canopy, NDVI) that quantifies local ecological conditions.";
  const defaultWhy =
    "Tracking this indicator helps prioritize interventions, measure progress, and connect actions to outcomes like reduced temperature or improved air quality.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200/60 dark:border-neutral-800/80 p-6 max-w-md w-full animate-fadeIn relative ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 20 }}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/40 dark:border-neutral-700/40">
            Environmental Metric
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold font-poppins text-neutral-800 dark:text-neutral-100 mb-4">
              {title}
            </h2>
            <div className="text-neutral-600 dark:text-neutral-350 text-sm leading-[1.6]">
              <div className="mb-4">
                <h3 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200 mb-1">
                  What it is
                </h3>
                <p>{what ?? defaultWhat}</p>
              </div>
              <div className="mb-4">
                <h3 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200 mb-1">
                  Why it matters
                </h3>
                <p>{why ?? defaultWhy}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Source
                  </h3>
                  <p className="text-neutral-700 dark:text-neutral-300 font-medium text-xs">
                    {source ?? "Satellite Data"}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Frequency
                  </h3>
                  <p className="text-neutral-700 dark:text-neutral-300 font-medium text-xs">
                    {frequency ?? "Annual"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.18s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

interface ChartInfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  source?: string;
  frequency?: string;
}

export function ChartInfoModal({
  open,
  onClose,
  title,
  description,
  source,
  frequency,
}: ChartInfoModalProps) {
  if (!open) return null;
  const parts = description ? description.split("\n\n") : [];
  const what = parts[0];
  const why = parts[1];
  const defaultWhat =
    "A visual representation showing the indicator values over time or across locations (e.g., trend, comparison).";
  const defaultWhy =
    "Charts reveal trends, anomalies, and correlations so stakeholders can make data-driven planning and resource allocation decisions.";
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200/60 dark:border-neutral-800/80 p-6 max-w-md w-full animate-fadeIn relative ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 20 }}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/40 dark:border-neutral-700/40">
            Chart Data
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold font-poppins text-neutral-800 dark:text-neutral-100 mb-4">
              {title}
            </h2>
            <div className="text-neutral-600 dark:text-neutral-350 text-sm leading-[1.6]">
              <div className="mb-4">
                <h3 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200 mb-1">
                  What it is
                </h3>
                <p>{what ?? defaultWhat}</p>
              </div>
              <div className="mb-4">
                <h3 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200 mb-1">
                  Why it matters
                </h3>
                <p>{why ?? defaultWhy}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800/80">
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Source
                  </h3>
                  <p className="text-neutral-700 dark:text-neutral-300 font-medium text-xs">
                    {source ?? "Historical Satellite Feed"}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                    Frequency
                  </h3>
                  <p className="text-neutral-700 dark:text-neutral-300 font-medium text-xs">
                    {frequency ?? "Annual Trend"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.18s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
