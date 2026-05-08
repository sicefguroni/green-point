import type { InterventionType } from "@/lib/simulation/coefficients";

/**
 * Raw engine inputs. The deterministic engine and the API route speak this
 * shape. The Advanced drawer edits it directly; the simple stepper edits the
 * `SimulationIntent` and resolves to this via `lib/simulation/presets.ts`.
 */
export type SimulationInputsState = {
  temperature_increase_rate: number;
  flooding_severity: "low" | "medium" | "high";
  rainfall_change_rate: number;
  canopy_target_percent: number;
  ndvi_target: number;
  intervention_type: InterventionType | string;
  total_budget_cap: number;
  cost_per_sqm: number;
  maintenance_cost_rate: number;
  time_horizon: number;
};

/** Simple, intuitive front-door used by the stepper UI. */
export type ClimateFuture = "stable" | "warming" | "severe";
export type AmbitionLevel = "light" | "moderate" | "ambitious" | "transformative";
export type BudgetTier = "small" | "medium" | "large" | "custom";
/** Years between 1 and 25; the stepper UI exposes this as a slider. */
export type TimeHorizon = number;

export type SimulationIntent = {
  climateFuture: ClimateFuture;
  strategy: InterventionType;
  ambition: AmbitionLevel;
  budgetTier: BudgetTier;
  /** Used when budgetTier === "custom". */
  customBudgetPHP?: number;
  timeHorizon: TimeHorizon;
};

export type SimulationBaselineData = {
  name?: string;
  ndvi: number;
  lst: number;
  floodExposure: string;
  greeneryIndex: number;
  canopyCover: number;
  currentIntervention: string;
  /** Area of the barangay in hectares (computed from polygon). */
  areaHectares?: number;
};

export type MetricKey =
  | "lst"
  | "ndvi"
  | "canopy"
  | "gi"
  | "stormwater"
  | "pm25"
  | "no2"
  | "co2";

export type MetricEstimate = {
  key: MetricKey;
  label: string;
  unit: string;
  baseline: number;
  projected: number;
  delta: number;
  low: number;
  high: number;
  direction: "up-good" | "down-good";
  note?: string;
};

export type AreaAggregate = {
  key: string;
  label: string;
  value: number;
  unit: string;
  note?: string;
};

export type GIEvolutionPoint = {
  year: number;
  gi_score: number;
  quantity_score: number;
  environmental_quality_score: number;
};

export type SimulationEstimates = {
  metrics: MetricEstimate[];
  giEvolution: GIEvolutionPoint[];
  finalGI: { gi_score: number; gi_level: string };
  barangayTotals: AreaAggregate[];
  costProjection: {
    capex: number;
    maintenanceNPV: number;
    totalPHP: number;
    budgetBinding: boolean;
    budgetCapPHP: number;
    realizedCanopyPercent: number;
  };
  sensitivity: { input: keyof SimulationInputsState; contribution: number }[];
  warnings: string[];
};

export type SimulationNarrative = {
  effectivenessRationale: string;
  shortcomings: string[];
  sensitivityNarrative: string;
  metricCitations: Partial<
    Record<MetricKey, { studyTitle: string; excerpt: string }[]>
  >;
  citedStudies: { studyTitle: string; similarity: number }[];
  alternativeStrategy?: { name: string; reason: string };
};

export type SimulationResultsState = {
  estimates: SimulationEstimates;
  narrative: SimulationNarrative | null;
  meta: { retrievedChunks: number; query: string; narrativeError?: string };
};
