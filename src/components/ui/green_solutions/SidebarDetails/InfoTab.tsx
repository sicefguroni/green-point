"use client";

import { type BarangayData } from "@/context/BarangayContext";
import { type GreenRecommendation } from "@/types/green_solutions";
import { type SelectedFeature } from "@/types/metrics";
import MetricsDashboard from "@/components/ui/green_solutions/MetricsDashboard";
import HalfCircleBar from "@/components/ui/dashboard/halfcirclebar";

interface InfoTabProps {
  recommendation: GreenRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
}

// Efficiency-level → Tailwind token map (mirrors GreenSolutionCard internals)
const efficiencyStyles: Record<
  GreenRecommendation["efficiencyLevel"],
  { bg: string; text: string; border: string; lighterbg: string }
> = {
  "Highly Efficient": {
    bg: "bg-green-400",
    text: "text-green-900",
    border: "border-green-400",
    lighterbg: "bg-green-50",
  },
  "Moderately Efficient": {
    bg: "bg-yellow-400",
    text: "text-yellow-800",
    border: "border-yellow-400",
    lighterbg: "bg-yellow-50",
  },
  "Not Efficient": {
    bg: "bg-red-400",
    text: "text-red-800",
    border: "border-red-400",
    lighterbg: "bg-red-50",
  },
};

export default function InfoTab({
  recommendation,
  selectedFeature,
  selectedBarangayData,
}: InfoTabProps) {
  const styles = efficiencyStyles[recommendation.efficiencyLevel];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 scrollbar-hide">
      {/* ── Recommendation hero card ── */}
      <div
        className={`flex items-center gap-5 p-5 rounded-2xl border ${styles.border} ${styles.lighterbg}`}
      >
        <div className={`p-4 rounded-2xl shrink-0 ${styles.bg} ${styles.text}`}>
          {recommendation.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-neutral-900">
              {recommendation.solutionTitle}
            </h2>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${styles.bg} ${styles.text}`}
            >
              {recommendation.efficiencyLevel.split(" ")[0]}
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            {recommendation.solutionDescription}
          </p>
        </div>
        <div className="shrink-0">
          <HalfCircleBar
            sizePx={90}
            min={0}
            max={100}
            value={recommendation.value}
            trailColor="rgba(0,0,0,0.05)"
          />
        </div>
      </div>

      {/* ── About ── */}
      <section className="space-y-2">
        <SectionLabel>About This Intervention</SectionLabel>
        <p className="text-neutral-700 text-sm leading-relaxed">
          {recommendation.detailedDescription}
        </p>
      </section>

      {/* ── Technical specs ── */}
      <section className="space-y-3">
        <SectionLabel>Technical Specs</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <SpecCard
            label="Equity Index"
            value={recommendation.equityIndex}
            thresholds={[0.7, 0.4]}
            higherIsBetter
          />
          <SpecCard
            label="Cost Index"
            value={recommendation.cost}
            thresholds={[0.3, 0.6]}
            higherIsBetter={false}
          />
          <SpecCard
            label="Impact Score"
            value={recommendation.impact}
            thresholds={[0.7, 0.4]}
            higherIsBetter
          />
        </div>
      </section>

      {/* ── Location context ── */}
      <section className="space-y-3">
        <SectionLabel>Location Context</SectionLabel>
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1.5">
          <p className="font-bold text-sm text-neutral-800">{selectedFeature.name}</p>
          <p className="text-xs text-neutral-400 truncate">{selectedFeature.address}</p>
          {selectedFeature.barangay && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-green-100 text-green-700 rounded-full">
              Barangay {selectedFeature.barangay}
            </span>
          )}
        </div>
      </section>

      {/* ── Barangay metrics (from context) ── */}
      <section className="space-y-3">
        <SectionLabel>Barangay Metrics</SectionLabel>
        <MetricsDashboard barangayData={selectedBarangayData} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
      {children}
    </h3>
  );
}

function SpecCard({
  label,
  value,
  thresholds,
  higherIsBetter,
}: {
  label: string;
  value: number;
  thresholds: [number, number];
  higherIsBetter: boolean;
}) {
  const isGood = higherIsBetter ? value >= thresholds[0] : value <= thresholds[0];
  const isMid = higherIsBetter
    ? value >= thresholds[1] && value < thresholds[0]
    : value > thresholds[0] && value <= thresholds[1];
  const color = isGood ? "text-green-600" : isMid ? "text-yellow-600" : "text-red-600";

  return (
    <div className="bg-neutral-50 rounded-2xl p-4 text-center border border-neutral-100">
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold font-poppins ${color}`}>{value.toFixed(2)}</p>
    </div>
  );
}
