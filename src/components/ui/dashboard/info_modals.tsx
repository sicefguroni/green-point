"use client";

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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full animate-fadeIn relative ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 20 }}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-black/60 hover:text-neutral-black transition"
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

        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
            Environmental Metric
          </span>
        </div>

        <div className="flex items-start gap-3 mb-3">
          <div className="mt-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-green-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C8 6 6 8 6 11c0 3 2 5 6 9 4-4 6-6 6-9 0-3-2-5-6-9z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-neutral-black mb-1">
              {title}
            </h2>
            <div className="text-neutral-black/70 text-sm leading-[1.6]">
              <div className="mb-3">
                <h3 className="font-medium text-sm text-neutral-black/90 mb-1">
                  What it is
                </h3>
                <p>{what ?? defaultWhat}</p>
              </div>
              <div className="mb-3">
                <h3 className="font-medium text-sm text-neutral-black/90 mb-1">
                  Why it matters
                </h3>
                <p>{why ?? defaultWhy}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 uppercase tracking-widest mb-1">
                    Source
                  </h3>
                  <p className="text-neutral-800 font-medium text-xs">
                    {source ?? "Satellite Data"}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 uppercase tracking-widest mb-1">
                    Frequency
                  </h3>
                  <p className="text-neutral-800 font-medium text-xs">
                    {frequency ?? "Annual"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-green-50 border border-green-100 p-3 rounded-md">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-600 mt-0.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C8 6 6 8 6 11c0 3 2 5 6 9 4-4 6-6 6-9 0-3-2-5-6-9z" />
            </svg>
            <div className="text-sm">
              <div className="font-semibold text-neutral-black">AI Insight</div>
              <div className="text-neutral-black/70 text-sm leading-[1.4]">
                In Mandaue, increasing this by 5% could lower local temperatures
                by 1°C.
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full animate-fadeIn relative ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 20 }}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-black/60 hover:text-neutral-black transition"
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

        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
            Chart Data
          </span>
        </div>

        <div className="flex items-start gap-3 mb-3">
          <div className="mt-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-sky-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M3 3v18h18V3H3zm5 13H6v-6h2v6zm4 0h-2V8h2v8zm4 0h-2v-4h2v4z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-neutral-black mb-1">
              {title}
            </h2>
            <div className="text-neutral-black/70 text-sm leading-[1.6]">
              <div className="mb-3">
                <h3 className="font-medium text-sm text-neutral-black/90 mb-1">
                  What it is
                </h3>
                <p>{what ?? defaultWhat}</p>
              </div>
              <div className="mb-3">
                <h3 className="font-medium text-sm text-neutral-black/90 mb-1">
                  Why it matters
                </h3>
                <p>{why ?? defaultWhy}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 uppercase tracking-widest mb-1">
                    Source
                  </h3>
                  <p className="text-neutral-800 font-medium text-xs">
                    {source ?? "Historical Satellite Feed"}
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-[10px] text-neutral-400 uppercase tracking-widest mb-1">
                    Frequency
                  </h3>
                  <p className="text-neutral-800 font-medium text-xs">
                    {frequency ?? "Annual Trend"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-sky-50 border border-sky-100 p-3 rounded-md">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-sky-600 mt-0.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M3 3v18h18V3H3zm5 13H6v-6h2v6zm4 0h-2V8h2v8zm4 0h-2v-4h2v4z" />
            </svg>
            <div className="text-sm">
              <div className="font-semibold text-neutral-black">AI Insight</div>
              <div className="text-neutral-black/70 text-sm leading-[1.4]">
                Based on local data, a 10% shift in this series correlates with
                improved air quality during the dry season.
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
