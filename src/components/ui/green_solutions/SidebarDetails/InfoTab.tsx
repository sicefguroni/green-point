"use client";

import { useState, useEffect } from "react";
import { type BarangayData } from "@/context/BarangayContext";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import { type CostEstimate } from "@/types/green_solutions";
import MetricsDashboard from "@/components/ui/green_solutions/MetricsDashboard";
import GreenSolutionCard from "../../general/cards/greensolution-infocard";
import CostEstimateCard from "./CostEstimateCard";

interface InfoTabProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
}

export default function InfoTab({
  recommendation,
  selectedFeature,
  selectedBarangayData,
}: InfoTabProps) {
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(
    recommendation.costEstimate || null,
  );
  const [isLoadingCost, setIsLoadingCost] = useState(
    !recommendation.costEstimate,
  );

  const selectedAreaSqm =
    selectedFeature.customSelectionAreaHectares !== undefined &&
    selectedFeature.customSelectionAreaHectares !== null
      ? selectedFeature.customSelectionAreaHectares * 10000
      : null;

  const selectedBarangayId =
    selectedFeature.barangay?.trim().length > 0
      ? selectedFeature.barangay
      : null;

  const interventionType =
    recommendation.interventionType || recommendation.solutionTitle;

  useEffect(() => {
    if (recommendation.costEstimate) {
      setCostEstimate(recommendation.costEstimate);
      setIsLoadingCost(false);
      return;
    }

    const fetchCostEstimate = async () => {
      setIsLoadingCost(true);
      setCostEstimate(null);

      try {
        const params = new URLSearchParams({
          interventionType,
          ...(selectedAreaSqm !== null && { area: selectedAreaSqm.toString() }),
          ...(selectedBarangayId && { barangayId: selectedBarangayId }),
        });

        const response = await fetch(`/api/cost-estimate?${params}`);
        const result = await response.json();

        if (result.success) {
          setCostEstimate(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch cost estimate:", error);
      } finally {
        setIsLoadingCost(false);
      }
    };

    void fetchCostEstimate();
  }, [
    interventionType,
    recommendation.costEstimate,
    selectedAreaSqm,
    selectedBarangayId,
  ]);

  return (
    <div className="sm:px-2 lg:px-6 h-full overflow-y-auto space-y-4 scrollbar-hide pb-10">
      {/* ── Recommendation hero card (matches the list item style) ── */}
      <GreenSolutionCard
        solutionTitle={recommendation.solutionTitle}
        solutionDescription={recommendation.solutionDescription}
        efficiencyLevel={recommendation.efficiencyLevel}
        value={recommendation.value}
        icon={recommendation.icon}
        equityIndex={recommendation.equityIndex}
        cost={recommendation.cost}
        impact={recommendation.impact}
        detailedDescription={recommendation.detailedDescription}
        justification={recommendation.justification}
        recommendedSpecies={recommendation.recommendedSpecies}
        hideButton
      />

      {/* ── About ── */}
      <section className="space-y-2 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
        <SectionLabel>About This Intervention</SectionLabel>
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          {recommendation.detailedDescription}
        </p>
      </section>

      {/* ── Justification ── */}
      {recommendation.justification && (
        <section className="space-y-2 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
          <SectionLabel>Site-Specific Justification</SectionLabel>
          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 italic">
            &ldquo;{recommendation.justification}&rdquo;
          </p>
        </section>
      )}

      {/* ── Species ── */}
      {recommendation.recommendedSpecies && (
        <section className="space-y-3 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
          <SectionLabel>Recommended Species</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {recommendation.recommendedSpecies.split(/,\s*(?![^()]*\))/).map((s) => (
              <span
                key={s}
                className="inline-block rounded-xl bg-white px-3 py-1 text-xs font-semibold text-green-700 border border-green-100 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20 shadow-sm"
              >
                {s.trim()}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Technical specs ── */}
      <section className="space-y-3 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
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

      {/* ── Cost Estimate ── */}
      {costEstimate && (
        <section>
          <SectionLabel>Cost Estimate Document</SectionLabel>
          <CostEstimateCard
            costEstimate={costEstimate}
            isLoading={isLoadingCost}
            siteName={selectedFeature.name}
            siteAddress={selectedFeature.address}
            barangayName={selectedFeature.barangay}
            areaHectares={selectedFeature.customSelectionAreaHectares}
          />
        </section>
      )}

      {/* ── Location context ── */}
      <section className="space-y-3 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
        <SectionLabel>Location Context</SectionLabel>
        <div className="space-y-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950/50 shadow-sm">
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-100">
            {selectedFeature.name}
          </p>
          <p className="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
            {selectedFeature.address}
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {selectedFeature.barangay && (
              <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
                Barangay {selectedFeature.barangay}
              </span>
            )}
            {selectedFeature.customSelectionAreaHectares !== undefined &&
              selectedFeature.customSelectionAreaHectares !== null && (
                <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Area {selectedFeature.customSelectionAreaHectares.toFixed(2)} ha
                </span>
              )}
          </div>
        </div>
      </section>

      {/* ── Barangay metrics (from context) ── */}
      <section className="space-y-3 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
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
    <h3 className="text-sm font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
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
  const isGood = higherIsBetter
    ? value >= thresholds[0]
    : value <= thresholds[0];
  const isMid = higherIsBetter
    ? value >= thresholds[1] && value < thresholds[0]
    : value > thresholds[0] && value <= thresholds[1];
  const color = isGood
    ? "text-green-600 dark:text-green-400"
    : isMid
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-center dark:border-neutral-700/50 dark:bg-neutral-950/50 shadow-sm">
      <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className={`text-2xl font-bold font-poppins tracking-tight ${color}`}>
        {value.toFixed(2)}
      </p>
    </div>
  );
}