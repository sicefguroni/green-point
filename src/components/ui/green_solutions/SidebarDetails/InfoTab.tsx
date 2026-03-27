"use client";

import { useState, useEffect } from "react";
import { type BarangayData } from "@/context/BarangayContext";
import { type GreenRecommendation, type CostEstimate } from "@/types/green_solutions";
import { type SelectedFeature } from "@/types/metrics";
import MetricsDashboard from "@/components/ui/green_solutions/MetricsDashboard";
import HalfCircleBar from "@/components/ui/dashboard/halfcirclebar";
import GreenSolutionCard from "../../general/cards/greensolution-infocard";
import CostEstimateCard from "./CostEstimateCard";

interface InfoTabProps {
  recommendation: GreenRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
}

export default function InfoTab({
  recommendation,
  selectedFeature,
  selectedBarangayData,
}: InfoTabProps) {
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(
    recommendation.costEstimate || null
  );
  const [isLoadingCost, setIsLoadingCost] = useState(!recommendation.costEstimate);

  useEffect(() => {
    // If cost estimate is already provided, skip fetching
    if (recommendation.costEstimate) {
      setCostEstimate(recommendation.costEstimate);
      setIsLoadingCost(false);
      return;
    }

    // Fetch cost estimate from API
    const fetchCostEstimate = async () => {
      try {
        const params = new URLSearchParams({
          interventionType: recommendation.solutionTitle,
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

    fetchCostEstimate();
  }, [recommendation]);

  return (
    <div className="sm:px-2 lg:px-6 h-full overflow-y-auto space-y-6 scrollbar-hide">
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
        hideButton
      />

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

      {/* ── Cost Estimate ── */}
      {costEstimate && (
        <section>
          <SectionLabel>Project Cost</SectionLabel>
          <CostEstimateCard 
            costEstimate={costEstimate} 
            isLoading={isLoadingCost}
          />
        </section>
      )}

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
