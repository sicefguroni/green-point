/**
 * Utility functions for working with recommendations
 * Bridges between schema (GreeningRecommendation) and UI concerns (icons, display values)
 */

import React from "react";
import { GreeningRecommendation } from "@/types/schema";
import { getRecommendationIcon } from "./recommendation-icons";
import { CostEstimate } from "@/types/green_solutions";
import { applyStudyCitations } from "@/lib/recommendations/generation-quality";

function slugifyRecommendationName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function priorityRank(p: string | undefined | null): number {
  const s = (p ?? "").toLowerCase();
  if (s === "high") return 3;
  if (s === "medium") return 2;
  if (s === "low") return 1;
  return 0;
}

/** Parse JSON / AI values that may be strings (e.g. "0.75"). */
export function parseScore(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 0–1 cost index for rating: AI uses 0–1; legacy rows use PHP. Treats cost 0 as valid (cheap).
 */
export function normalizeCostForRating(cost: unknown): number {
  if (cost === null || cost === undefined || cost === "") return 0.5;
  const c = parseScore(cost, NaN);
  if (!Number.isFinite(c)) return 0.5;
  return c > 1 ? Math.min(c / 100_000, 1) : clamp01(c);
}

function readRecommendationCostValue(rec: Record<string, unknown>): unknown {
  if (rec.cost !== null && rec.cost !== undefined && rec.cost !== "") {
    return rec.cost;
  }

  const costEstimate = rec.costEstimate as { totalEstimate?: unknown } | null | undefined;
  return costEstimate?.totalEstimate;
}

/** Inputs for composite score (matches AI + schema recommendations). */
export type OverallRatingInput = {
  efficiency?: number | null;
  equity?: number | null;
  /** 0–1 normalized (lower = cheaper); raw PHP amounts normalized consistently */
  cost?: number | null;
  impact?: number | null;
  relevancy?: number | null;
  /** 0–1 practical feasibility (institutional, logistics, maintenance, tenure) */
  feasibility?: number | null;
  priority?: string | null;
};

/**
 * Composite 0–100 overall rating: efficiency, equity, impact, value-for-money,
 * relevancy, and feasibility (how practical to implement locally).
 *
 * Impact and value-for-money intentionally carry more weight than pure
 * contextual relevancy, so a recommendation does not win only because it
 * matches the area's biggest hazard while producing weaker GI/cooling benefit
 * or costing much more.
 */
export function computeOverallRating(input: OverallRatingInput): number {
  const eff = clamp01((Number(input.efficiency) || 0) / 100);
  const eq = clamp01(Number(input.equity) || 0);
  const costNorm = normalizeCostForRating(input.cost);
  const valueForMoney = clamp01(1 - costNorm);
  const impRaw = Number(input.impact);
  const imp = Number.isFinite(impRaw) ? clamp01(impRaw) : eff;
  const rel = clamp01(Number(input.relevancy) || 0);
  const feasRaw = input.feasibility;
  const feas = feasRaw === null || feasRaw === undefined
    ? 0.5
    : clamp01(Number(feasRaw) || 0);
  const base =
    eff * 0.18 +
    eq * 0.08 +
    imp * 0.26 +
    valueForMoney * 0.22 +
    rel * 0.12 +
    feas * 0.14;
  return Math.round(Math.min(100, Math.max(0, base * 100)) * 10) / 10;
}

/** Build rating input from API / DB / AI objects (stable field access). */
export function recommendationToRatingInput(
  rec: Record<string, unknown>,
): OverallRatingInput {
  const anyRec = rec as Record<string, unknown>;
  const efficiency = parseScore(anyRec.efficiency, 0);
  const equity = parseScore(anyRec.equity, 0);
  const impactRaw = parseScore(anyRec.impact, NaN);
  const impact = Number.isFinite(impactRaw)
    ? impactRaw
    : efficiency / 100;
  const relevancy = parseScore(anyRec.relevancy, 0);
  const feasibility = parseScore(anyRec.feasibility, 0.5);
  return {
    efficiency,
    equity,
    cost: readRecommendationCostValue(anyRec) as number | null | undefined,
    impact,
    relevancy,
    feasibility,
    priority: (anyRec.priority as string | undefined) ?? "medium",
  };
}

/** Descending by overall rating; tie-break: priority, then name. */
export function compareRecommendationsByOverallRating(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const ra = computeOverallRating(recommendationToRatingInput(a));
  const rb = computeOverallRating(recommendationToRatingInput(b));
  if (Math.abs(rb - ra) > 1e-6) return rb - ra;
  const pr = priorityRank(String(b.priority)) - priorityRank(String(a.priority));
  if (pr !== 0) return pr;
  return String(a.name ?? "").localeCompare(String(b.name ?? ""));
}

/** After enrich, re-sort so order matches post-parse scores (and tie-break titles). */
export function sortUIRecommendationsByOverallRating(
  recs: UIRecommendation[],
): UIRecommendation[] {
  return [...recs].sort((a, b) => {
    const d = b.overallRating - a.overallRating;
    if (d !== 0) return d;
    return a.solutionTitle.localeCompare(b.solutionTitle);
  });
}

/**
 * UI-enhanced recommendation with icon and display properties
 */
export interface UIRecommendation extends GreeningRecommendation {
  icon: React.ReactNode;
  solutionTitle: string;
  /** Brief description for the card view (max 10 words) */
  solutionDescription: string;
  /** Detailed 1-2 sentence description for the detail view */
  detailedDescription: string;
  /** Site-specific justification (metric-based) */
  justification?: string;
  /** Suggested plant species */
  recommendedSpecies?: string;
  efficiencyLevel:
    | "Highly Efficient"
    | "Moderately Efficient"
    | "Not Efficient";
  value: number; // 0-100 efficiency display value
  equityIndex: number; // 0-1
  cost: number; // 0-1 normalized cost index
  impact: number; // 0-1 impact score
  /** Composite 0–100 (efficiency, equity, impact, value, relevancy, feasibility) */
  overallRating: number;
  /** 0–1 practical feasibility when provided by AI */
  feasibility?: number;
  // RAG / AI specific fields
  rationale?: string;
  sourceStudy?: string | null;
  costEstimate?: CostEstimate | null;
}

/**
 * Transform a GreeningRecommendation into a UI-ready format with icons and display values
 */
export function enrichRecommendation(
  rec: GreeningRecommendation,
): UIRecommendation {
  const IconComponent = getRecommendationIcon(rec.recommendationID);
  const anyRec = rec as unknown as Record<string, unknown>;
  const recommendationIdFallback =
    typeof anyRec.recommendationId === "string" &&
    anyRec.recommendationId.trim().length > 0
      ? anyRec.recommendationId
      : slugifyRecommendationName(rec.name);
  const resolvedRecommendationId =
    rec.recommendationID || recommendationIdFallback;
  const resolvedId = rec.id || resolvedRecommendationId;

  // Determine efficiency level based on efficiency score
  let efficiencyLevel:
    | "Highly Efficient"
    | "Moderately Efficient"
    | "Not Efficient";
  const efficiency = parseScore(rec.efficiency, 0);
  if (efficiency >= 70) {
    efficiencyLevel = "Highly Efficient";
  } else if (efficiency >= 40) {
    efficiencyLevel = "Moderately Efficient";
  } else {
    efficiencyLevel = "Not Efficient";
  }

  const options =
    (rec.implementationOptions as Record<string, unknown> | null | undefined) ||
    {};
  const costEstimate = anyRec.costEstimate as
    | { totalEstimate?: unknown }
    | null
    | undefined;
  const rawCost = anyRec.cost ?? costEstimate?.totalEstimate ?? null;
  const priorityFallback =
    typeof anyRec.priority === "string" && anyRec.priority.trim().length > 0
      ? anyRec.priority
      : "medium";
  const statusFallback =
    typeof anyRec.status === "string" && anyRec.status.trim().length > 0
      ? anyRec.status
      : "active";
  const summary =
    typeof anyRec.summary === "string" && anyRec.summary.trim().length > 0
      ? anyRec.summary
      : rec.description;
  const justification =
    typeof anyRec.justification === "string" &&
    anyRec.justification.trim().length > 0
      ? anyRec.justification
      : undefined;
  const recommendedSpecies =
    typeof anyRec.recommendedSpecies === "string" &&
    anyRec.recommendedSpecies.trim().length > 0
      ? anyRec.recommendedSpecies
      : undefined;
  let rationale =
    typeof anyRec.rationale === "string" && anyRec.rationale.trim().length > 0
      ? anyRec.rationale
      : typeof options.rationale === "string" &&
          options.rationale.trim().length > 0
        ? options.rationale
        : undefined;
  const sourceStudy =
    typeof anyRec.sourceStudy === "string" &&
    anyRec.sourceStudy.trim().length > 0
      ? anyRec.sourceStudy
      : typeof options.sourceStudy === "string" &&
          options.sourceStudy.trim().length > 0
        ? options.sourceStudy
        : null;

  if (rationale && sourceStudy) {
    const fixed = applyStudyCitations(
      {
        name: rec.name,
        interventionType: rec.interventionType,
        summary,
        description: rec.description,
        justification: justification ?? "",
        recommendedSpecies: recommendedSpecies ?? "",
        rationale,
        sourceStudy,
      },
      [{ studyTitle: sourceStudy }],
    );
    rationale = fixed.rationale ?? rationale;
  }

  const equityIndex = parseScore(rec.equity, 0);
  const costIndex = normalizeCostForRating(rawCost);

  const impactRaw = parseScore(anyRec.impact, NaN);
  const impactScore = Number.isFinite(impactRaw)
    ? impactRaw
    : efficiency / 100;

  const feasibility = parseScore(anyRec.feasibility, 0.5);

  const overallRating = computeOverallRating(
    recommendationToRatingInput({
      ...anyRec,
      name: rec.name,
      efficiency,
      equity: equityIndex,
      cost: rawCost,
      impact: impactScore,
      relevancy: parseScore(rec.relevancy, 0),
      feasibility,
      priority: rec.priority || priorityFallback,
    }),
  );

  return {
    ...rec,
    id: resolvedId,
    recommendationID: resolvedRecommendationId,
    source: rec.source || "AI Recommendation",
    priority: rec.priority || priorityFallback,
    status: rec.status || statusFallback,
    hasBudget: rec.hasBudget ?? false,
    createdAt: rec.createdAt || new Date(),
    updatedAt: rec.updatedAt || new Date(),
    icon: React.createElement(IconComponent, { size: 26 }),
    solutionTitle: rec.name,
    solutionDescription: summary, // Brief description for the card
    detailedDescription: rec.description, // Detailed description of what it is
    justification, // Why it's recommended here
    recommendedSpecies,
    efficiencyLevel,
    value: efficiency,
    equityIndex,
    cost: costIndex,
    impact: impactScore,
    overallRating,
    feasibility,
    rationale, // Grounded scientific rationale
    sourceStudy,
    costEstimate: (anyRec.costEstimate as CostEstimate | null | undefined) || null,
  };
}

/**
 * Centralized reference recommendations matching the schema
 */
export const SCHEMA_RECOMMENDATIONS: GreeningRecommendation[] = [
  {
    id: "1",
    recommendationID: "street-trees",
    name: "Street Trees",
    source: "City Planning",
    description: "Vertical greening for urban corridors.",
    interventionType: "Urban Canopy Enhancement",
    relevancy: 0.9,
    efficiency: 90,
    cost: 50000,
    costUnit: "PHP",
    equity: 0.9,
    priority: "high",
    status: "active",
    hasBudget: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as GreeningRecommendation,
  {
    id: "2",
    recommendationID: "roof-gardens",
    name: "Roof Gardens",
    source: "City Planning",
    description: "Utilizing unused vertical space.",
    interventionType: "Building Envelope Green",
    relevancy: 0.65,
    efficiency: 40,
    cost: 33000,
    costUnit: "PHP",
    equity: 0.5,
    priority: "medium",
    status: "active",
    hasBudget: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as GreeningRecommendation,
  {
    id: "3",
    recommendationID: "blue-green-corridors",
    name: "Blue-Green Corridors",
    source: "City Planning",
    description: "Integrated hydrological pathways.",
    interventionType: "Water Management",
    relevancy: 0.8,
    efficiency: 30,
    cost: 15000,
    costUnit: "PHP",
    equity: 0.7,
    priority: "high",
    status: "active",
    hasBudget: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as GreeningRecommendation,
];

/**
 * Get all recommendations in UI-ready format
 */
export function getUIRecommendations(): UIRecommendation[] {
  return SCHEMA_RECOMMENDATIONS.map(enrichRecommendation).sort(
    (a, b) => b.overallRating - a.overallRating,
  );
}

/**
 * Get a specific recommendation in UI-ready format
 */
export function getUIRecommendation(id: string): UIRecommendation | undefined {
  const rec = SCHEMA_RECOMMENDATIONS.find(
    (r) => r.recommendationID === id || r.id === id,
  );
  return rec ? enrichRecommendation(rec) : undefined;
}
