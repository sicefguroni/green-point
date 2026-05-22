import type { InterventionType } from "@/lib/simulation/coefficients";
import type { BarangaySnapshot } from "./use-ai-recommendations";

/** Status label based on overall rating ranges. */
export type Status = "Excellent" | "Good" | "Fair" | "Poor";

/** Lightweight per-strategy evaluation for dashboard display columns. */
export type StrategyEvalLite = {
  costPHP: number;
  impactGI: number;
  canopyDeltaPct: number;
  coolingDeltaC: number;
  pm25KgPerYear: number;
  overallRating: number;
};

/** A single row in the intervention analysis table. */
export type TableRow = {
  id: number;
  barangay: string;
  equity: number;
  costPHP: number;
  costNormalized: number;
  impactGI: number;
  canopyDelta: number;
  /** ΔLST in °C. Negative (cooling) is the desirable direction. */
  coolingDeltaC: number;
  /** PM2.5 removed per year in kg (canonical run). */
  pm25KgPerYear: number;
  costPerImpact: number;
  status: Status;
  recommendedIntervention: string;
  recommendationKey: InterventionType;
  recommendationTagline: string;
  /** Most severe site challenge this intervention is meant to alleviate, if any. */
  primaryChallengeLabel?: string;
  /** 0–100 composite rating (same formula the map tab's recommendation cards use). */
  overallRating: number;
  areaHectares: number;
  /** Lifecycle cost estimate (capital + maintenance) matching `/api/cost-estimate`. */
  lifecycleCost: number;
  source: string;
  /** Snapshot used to identify the row when fetching AI recommendations. */
  snapshot: BarangaySnapshot;
  /**
   * Pre-computed deterministic evaluation per canonical strategy. Lets the
   * row renderer instantly look up the score / cost / impact for whatever
   * strategy the AI ends up picking, without running the engine again.
   */
  evalByStrategy: Map<InterventionType, StrategyEvalLite>;
};

/** Arbitrary key-value properties on a GeoJSON feature properties bag. */
export type DashboardMetricProperties = Record<string, unknown>;

/** Row from the static `/geo/mandaue_barangays_gi.geojson` endpoint. */
export type StaticBarangayMetricRow = {
  name: string;
  greenery_index?: number | null;
  ndvi?: number | null;
  lst?: number | null;
  tree_canopy?: number | null;
  flood_exposure?: string | null;
  current_intervention?: string | null;
};

/** A single record from the bulk `/api/recommendations/by-barangay` endpoint. */
export type BulkRecEntry = {
  name: string;
  interventionType: string;
  summary: string;
  justification: string;
  priority: string;
  overallRating: number;
  costPHP?: number;
  impactGI?: number;
  canopyDeltaPct?: number;
  coolingDeltaC?: number;
  pm25KgPerYear?: number;
};
