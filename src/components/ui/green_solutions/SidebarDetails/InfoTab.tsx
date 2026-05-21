"use client";

import { useState, useEffect } from "react";
import { BookOpen, Leaf } from "lucide-react";
import { type BarangayData } from "@/context/BarangayContext";
import { type UIRecommendation } from "@/lib/recommendations";
import { resolveSelectedAreaHectares } from "@/lib/selection-area";
import { type SelectedFeature } from "@/types/metrics";
import { type CostEstimate } from "@/types/green_solutions";
import GreenSolutionCard from "../../general/cards/greensolution-infocard";
import CostEstimateCard from "./CostEstimateCard";
import { SPECIES_INFO } from "@/lib/green-solutions/species-info";

interface InfoTabProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
  isFullscreen?: boolean;
}

export default function InfoTab({
  recommendation,
  selectedFeature,
  selectedBarangayData,
  isFullscreen = false,
}: InfoTabProps) {
  const selectedAreaHectares = resolveSelectedAreaHectares({
    customSelectionAreaHectares: selectedFeature.customSelectionAreaHectares,
    pointSelectionAreaHectares: selectedFeature.pointSelectionAreaHectares,
    barangayAreaHectares: selectedBarangayData?.areaHectares,
  });
  const selectedAreaSqm =
    selectedAreaHectares !== null ? selectedAreaHectares * 10000 : null;

  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [isLoadingCost, setIsLoadingCost] = useState(true);

  const selectedBarangayId =
    selectedFeature.barangay?.trim().length > 0
      ? selectedFeature.barangay
      : null;

  const interventionType = [
    recommendation.solutionTitle,
    recommendation.interventionType,
  ]
    .filter((value): value is string => value.trim().length > 0)
    .join(" ");

  useEffect(() => {
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
          return;
        }

        if (recommendation.costEstimate) {
          setCostEstimate(recommendation.costEstimate);
        }
      } catch (error) {
        console.error("Failed to fetch cost estimate:", error);
        if (recommendation.costEstimate) {
          setCostEstimate(recommendation.costEstimate);
        }
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
    <div
      className={`h-full overflow-y-auto space-y-4 scrollbar-hide pb-10 ${
        isFullscreen ? "px-6" : ""
      }`}
    >
      <GreenSolutionCard
        solutionTitle={recommendation.solutionTitle}
        solutionDescription={recommendation.solutionDescription}
        efficiencyLevel={recommendation.efficiencyLevel}
        value={recommendation.value}
        hideButton
      />

      <section className="space-y-3 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
        <div className="flex items-start justify-between gap-3">
          <SectionLabel>About This Solution</SectionLabel>
          {recommendation.interventionType && (
            <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300">
              {recommendation.interventionType}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          {recommendation.detailedDescription}
        </p>
        {(recommendation.sourceStudy ?? recommendation.source) && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-200/50 dark:border-neutral-700/30">
            <BookOpen size={11} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
              Source:{" "}
              <span className="font-medium text-neutral-600 dark:text-neutral-400">
                {recommendation.sourceStudy ?? recommendation.source}
              </span>
            </p>
          </div>
        )}
      </section>

      {recommendation.justification && (
        <section className="space-y-3 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
          <SectionLabel>Why This Site?</SectionLabel>
          <div className="space-y-2.5">
            <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3.5 dark:bg-amber-500/5 dark:border-amber-500/15">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5">
                Site Conditions
              </p>
              <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                {recommendation.justification}
              </p>
            </div>
            {recommendation.rationale && (
              <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-3.5 dark:bg-sky-500/5 dark:border-sky-500/15">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400 mb-1.5">
                  Why This Approach Works
                </p>
                <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {recommendation.rationale}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {recommendation.recommendedSpecies && (
        <section className="space-y-3 rounded-2xl bg-neutral-100/40 p-5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
          <SectionLabel>Recommended Species</SectionLabel>
          <div className="space-y-2">
            {recommendation.recommendedSpecies
              .split(/,\s*(?![^()]*\))/)
              .map((rawSpecies) => {
                const cleanName = rawSpecies.trim().replace(/\s*\(.*?\)/g, "").trim();
                const info = SPECIES_INFO[cleanName.toLowerCase()];
                return (
                  <div
                    key={rawSpecies}
                    className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700/50 dark:bg-neutral-900/50"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 shrink-0">
                        <Leaf size={12} className="text-green-600 dark:text-green-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-100">
                          {cleanName}
                        </p>
                        {info && (
                          <p className="text-[10px] italic text-neutral-400 dark:text-neutral-500">
                            {info.scientific}
                          </p>
                        )}
                      </div>
                    </div>
                    {info ? (
                      <>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {info.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                          {info.description}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                        A suitable species for urban greening in this context.
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

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

      {costEstimate && (
        <section>
          <SectionLabel>Cost Estimate Document</SectionLabel>
          <CostEstimateCard
            costEstimate={costEstimate}
            isLoading={isLoadingCost}
            siteName={selectedFeature.name}
            siteAddress={selectedFeature.address}
            barangayName={selectedFeature.barangay}
            areaHectares={selectedAreaHectares}
          />
        </section>
      )}
    </div>
  );
}

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
