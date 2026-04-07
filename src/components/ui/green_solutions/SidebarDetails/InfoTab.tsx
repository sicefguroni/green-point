"use client";

import { useState, useEffect } from "react";
import { type BarangayData } from "@/context/BarangayContext";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import { type CostEstimate } from "@/types/green_solutions";
import MetricsDashboard from "@/components/ui/green_solutions/MetricsDashboard";
import HalfCircleBar from "@/components/ui/dashboard/halfcirclebar";
import GreenSolutionCard from "../../general/cards/greensolution-infocard";
import CostEstimateCard from "./CostEstimateCard";

type HazardEntry = {
  level: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function maxHazardLevel(entries?: HazardEntry[] | null): number | null {
  const levels = (entries ?? [])
    .map((entry) => entry.level)
    .filter((level): level is number => typeof level === "number" && Number.isFinite(level));
  if (levels.length === 0) {
    return null;
  }
  return Math.max(...levels);
}

function resolveAreaSqm(
  selectedFeature: SelectedFeature,
  selectedBarangayData: BarangayData | null,
): number | null {
  const properties = selectedFeature.properties as Record<string, unknown> | undefined;
  const directAreaSqm =
    toFiniteNumber(properties?.area_sqm) ??
    toFiniteNumber(properties?.areaSqm) ??
    toFiniteNumber(properties?.area_m2) ??
    toFiniteNumber(properties?.areaM2);
  if (directAreaSqm !== null && directAreaSqm > 0) {
    return directAreaSqm;
  }

  const directAreaKm2 =
    toFiniteNumber(properties?.area_km2) ??
    toFiniteNumber(properties?.areaKm2);
  if (directAreaKm2 !== null && directAreaKm2 > 0) {
    return directAreaKm2 * 1_000_000;
  }

  const isBarangayCoverage =
    selectedFeature.address === "Barangay Coverage" ||
    (selectedFeature.coords.lng === 0 && selectedFeature.coords.lat === 0);

  if (isBarangayCoverage) {
    const barangayAreaKm2 = selectedBarangayData?.area_km2 ?? null;
    if (barangayAreaKm2 !== null && barangayAreaKm2 > 0) {
      return barangayAreaKm2 * 1_000_000;
    }
  }

  return null;
}

function resolveScope(
  selectedFeature: SelectedFeature,
  areaSqm: number | null,
): "project" | "site" | "barangay" {
  const isBarangayCoverage =
    selectedFeature.address === "Barangay Coverage" ||
    (selectedFeature.coords.lng === 0 && selectedFeature.coords.lat === 0);

  if (isBarangayCoverage) {
    return "barangay";
  }

  return areaSqm !== null ? "site" : "project";
}

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
      const interventionType = recommendation.interventionType || recommendation.solutionTitle;
      const solutionTitle = recommendation.solutionTitle;
      const solutionDescription = recommendation.detailedDescription || recommendation.solutionDescription;
      const areaSqm = resolveAreaSqm(selectedFeature, selectedBarangayData);
      const scope = resolveScope(selectedFeature, areaSqm);
      const greeneryIndex =
        toFiniteNumber(selectedFeature.properties?.greeneryIndex) ??
        toFiniteNumber(selectedFeature.properties?.greenery_index) ??
        selectedBarangayData?.greeneryIndex ??
        null;
      const floodHazard = maxHazardLevel(selectedFeature.hazards?.flood);
      const stormHazard = maxHazardLevel(selectedFeature.hazards?.storm);
      const barangayId = selectedFeature.barangay || selectedBarangayData?.name || null;

      try {
        const response = await fetch("/api/cost-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interventionType: recommendation.interventionType,
            solutionTitle: recommendation.solutionTitle,
            solutionDescription: recommendation.solutionDescription,
            rationale: recommendation.rationale,
            sourceStudy: recommendation.sourceStudy,
            location: {
              name: selectedFeature.name,
              barangay: selectedFeature.barangay,
            },
            metrics: {
              ndvi:
                (selectedFeature.properties?.ndvi as number | undefined) ??
                selectedBarangayData?.ndvi,
              lst:
                (selectedFeature.properties?.temperature as number | undefined) ??
                (selectedFeature.properties?.lst as number | undefined) ??
                selectedBarangayData?.lst,
              treeCanopy:
                (selectedFeature.properties?.treeCanopy as number | undefined) ??
                selectedBarangayData?.treeCanopy,
              greeneryIndex:
                (selectedFeature.properties?.greeneryIndex as number | undefined) ??
                selectedBarangayData?.greeneryIndex,
              greeneryLevel: selectedBarangayData?.greeneryLevel,
              floodHazard:
                selectedFeature.hazards?.flood?.reduce(
                  (max, item) => Math.max(max, item.level ?? 0),
                  0,
                ) || undefined,
              stormHazard:
                selectedFeature.hazards?.storm?.reduce(
                  (max, item) => Math.max(max, item.level ?? 0),
                  0,
                ) || undefined,
              aqi:
                selectedFeature.hazards?.air?.[0]?.AQI_Level ??
                selectedBarangayData?.aqi,
            },
          }),
        });
        const params = new URLSearchParams();
        params.set("interventionType", interventionType);
        params.set("scope", scope);

        if (solutionTitle) {
          params.set("solutionTitle", solutionTitle);
        }

        if (solutionDescription) {
          params.set("solutionDescription", solutionDescription);
        }

        if (areaSqm !== null) {
          params.set("area", areaSqm.toString());
        }

        if (barangayId) {
          params.set("barangayId", barangayId);
        }

        if (greeneryIndex !== null) {
          params.set("greeneryIndex", greeneryIndex.toString());
        }

        if (floodHazard !== null) {
          params.set("floodHazard", floodHazard.toString());
        }

        if (stormHazard !== null) {
          params.set("stormHazard", stormHazard.toString());
        }

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

    setCostEstimate(null);
    setIsLoadingCost(true);
    fetchCostEstimate();
  }, [recommendation, selectedFeature, selectedBarangayData]);
  }, [recommendation, selectedBarangayData, selectedFeature]);

  return (
    <div className="sm:px-2 lg:px-6 h-full overflow-y-auto space-y-6 scrollbar-hide">

      {/* ── Research Background (RAG) ── */}
      {recommendation.rationale && (
        <section className="space-y-3">
          <SectionLabel>Scientific Rationale</SectionLabel>
          <div className="p-5 bg-primary-green/5 rounded-2xl border border-primary-green/10 shadow-sm">
            <p className="text-neutral-700 text-sm leading-relaxed">
              {recommendation.rationale}
            </p>
            {recommendation.sourceStudy && (
              <div className="mt-4 pt-4 border-t border-primary-green/10">
                <p className="text-[10px] font-black text-primary-green uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-green animate-pulse" />
                  Primary Research Citation
                </p>
                <p className="text-xs text-neutral-500 font-medium italic leading-relaxed">
                  {recommendation.sourceStudy}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

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
