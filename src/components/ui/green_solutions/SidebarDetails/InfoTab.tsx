"use client";

import { BookOpen, Leaf } from "lucide-react";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import { type CostEstimate } from "@/types/green_solutions";
import GreenSolutionCard from "../../general/cards/greensolution-infocard";
import CostEstimateCard from "./CostEstimateCard";
import { findSpecies } from "@/lib/green-solutions/species-catalog";
import {
  RELATIVE_COST_CAPTION,
  RELATIVE_COST_THRESHOLDS,
  relativeCostBand,
} from "@/lib/recommendations/relative-cost";

interface InfoTabProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  /** From useSiteCostEstimate, shared with the report export. */
  costEstimate: CostEstimate | null;
  isLoadingCost: boolean;
  /** Area of the selected site (custom shape, pin radius or barangay), ha. */
  siteAreaHectares: number | null;
  /** The share of the site the estimate prices (canonical treated footprint), ha. */
  treatedAreaHectares: number | null;
  isFullscreen?: boolean;
}

export default function InfoTab({
  recommendation,
  selectedFeature,
  costEstimate,
  isLoadingCost,
  siteAreaHectares,
  treatedAreaHectares,
  isFullscreen = false,
}: InfoTabProps) {
  return (
    <div
      className={`h-full overflow-y-auto space-y-2.5 scrollbar-hide pb-4 ${
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

      <section className="space-y-2 rounded-2xl bg-neutral-100/40 p-3.5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
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
        {recommendation.sourceStudy && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-200/50 dark:border-neutral-700/30">
            <BookOpen size={11} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
              Source:{" "}
              <span className="font-medium text-neutral-600 dark:text-neutral-400">
                {recommendation.sourceStudy}
              </span>
            </p>
          </div>
        )}
      </section>

      {recommendation.justification && (
        <section className="space-y-2 rounded-2xl bg-neutral-100/40 p-3.5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
          <SectionLabel>Why This Site?</SectionLabel>
          <div className="space-y-2">
            <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-2.5 dark:bg-amber-500/5 dark:border-amber-500/15">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5">
                Site Conditions
              </p>
              <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                {recommendation.justification}
              </p>
            </div>
            {recommendation.rationale && (
              <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-2.5 dark:bg-sky-500/5 dark:border-sky-500/15">
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
        <section className="space-y-2 rounded-2xl bg-neutral-100/40 p-3.5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
          <SectionLabel>Recommended Species</SectionLabel>
          <div className="space-y-1.5">
            {recommendation.recommendedSpecies
              .split(/,\s*(?![^()]*\))/)
              .map((rawSpecies) => {
                const cleanName = rawSpecies.trim().replace(/\s*\(.*?\)/g, "").trim();
                const info = findSpecies(rawSpecies);
                return (
                  <div
                    key={rawSpecies}
                    className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-700/50 dark:bg-neutral-900/50"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 shrink-0">
                        <Leaf size={12} className="text-green-600 dark:text-green-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-100">
                          {info?.name ?? cleanName}
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
                        <div className="flex flex-wrap gap-1 mb-1.5">
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
                    ) : null}
                  </div>
                );
              })}
          </div>
        </section>
      )}        <section className="space-y-2 rounded-2xl bg-neutral-100/40 p-3.5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
        <SectionLabel>Technical Specs</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <SpecCard
            label="Equity Index"
            value={recommendation.equityIndex}
            thresholds={[0.7, 0.4]}
            higherIsBetter
          />
          <SpecCard
            label="Relative Cost"
            value={recommendation.cost}
            thresholds={RELATIVE_COST_THRESHOLDS}
            higherIsBetter={false}
            display={relativeCostBand(recommendation.cost) ?? "—"}
            caption={RELATIVE_COST_CAPTION}
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
        <section className="rounded-2xl bg-neutral-100/40 p-3.5 border border-neutral-200/50 dark:bg-neutral-800/20 dark:border-neutral-700/30">
          <SectionLabel>Cost Estimate Document</SectionLabel>
          <div className="mt-1.5">
            <CostEstimateCard
              costEstimate={costEstimate}
              isLoading={isLoadingCost}
              siteName={selectedFeature.name}
              siteAddress={selectedFeature.address}
              barangayName={selectedFeature.barangay}
              siteAreaHectares={siteAreaHectares}
              treatedAreaHectares={treatedAreaHectares}
            />
          </div>
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
  display,
  caption,
}: {
  label: string;
  value: number;
  thresholds: [number, number];
  higherIsBetter: boolean;
  /** Shown instead of the number (e.g. a relative band). */
  display?: string;
  caption?: string;
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
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-700/50 dark:bg-neutral-950/50 shadow-sm">
      <p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className={`text-xl font-bold font-poppins tracking-tight ${color}`}>
        {display ?? value.toFixed(2)}
      </p>
      {caption ? (
        <p className="mt-0.5 text-[10px] leading-tight text-neutral-400 dark:text-neutral-500">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
