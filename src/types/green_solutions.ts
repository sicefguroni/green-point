/**
 * UI-specific types for green solutions components
 * Data models are in @/types/schema.ts (GreeningRecommendation)
 */

/** Which panel the left sidebar is showing */
export type SidebarView = "LIST" | "DETAIL";

/** Which tab is active inside the Detail panel */
export type DetailTab = "INFO" | "CHAT" | "TIMELINE" | "SAVED";

import type { LocationSelectionMode } from "@/types/maplayers";

interface GenerationParams {
  modelVersion: string;
  promptHash?: string;
  temperature?: number;
}

interface SolutionContext {
  mapState?: unknown;
  filters?: unknown;
  generationParams?: GenerationParams;
}

export interface SavePayload {
  locationType: LocationSelectionMode | "BARANGAY" | "POINT" | "CUSTOM";
  locationId?: string | null;
  locationName?: string | null;
  locationMetadata?: Record<string, unknown> | null;
  solutionSnapshot: Record<string, unknown>;
  contextSnapshot: SolutionContext;
  version?: number;
  previousVersionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Which timeline visualization is active inside the timeline tab */
export type TimelineViewMode = "DEFAULT" | "GANTT" | "PDF";

/** Optional AI chat context that can influence timeline planning */
export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

/** Native pricing unit used by the GreenPoint cost model (per the research brief). */
export type CostUnit =
  | "tree"
  | "sqm"
  | "linear-m"
  | "hectare"
  | "installation";

/** Cost estimate details for a greening intervention */
export interface CostEstimate {
  interventionType: string;
  /** Canonical strategy this intervention was normalised to (cost-model key). */
  strategyKey?: string;
  basePrice: number;
  totalEstimate: number;
  /**
   * CAPEX (capital cost) after location adjustment, before lifecycle
   * maintenance is added in `totalEstimate`.
   */
  capitalCost?: number;
  currencyUnit: string;
  perUnit: string;
  /** Native unit used to bill `basePrice`. */
  unit?: CostUnit;
  /**
   * Effective per-m² rate (basePrice × planning density). Lets the cost
   * card cross-check tree / installation pricing on a single area axis.
   */
  effectivePricePerSqm?: number;
  area: number | null;
  locationMultiplier: number;
  quantity?: number;
  lifecycleYears?: number;
  scope?: "project" | "site" | "barangay";
  breakdown: {
    materials: number;
    labor: number;
    contingency: number;
    permits?: number;
    maintenance?: number;
    other?: number;
  };
  estimateBasis?: string;
  confidence?: "low" | "medium" | "high";
  assumptions?: string[];
  costDrivers?: string[];
  technicalConsiderations?: TechnicalConsideration[];
  citations?: string[];
  lineItems?: CostLineItem[];
  marketReferences?: CostMarketReference[];
  sourceContext?: {
    query?: string;
    studies?: AssistantSource[];
    marketSearchQuery?: string;
    maintenance?: number;
  };
}

export interface AssistantSource {
  studyID?: string;
  studyTitle: string;
  similarity?: number;
}

export interface AssistantMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantChatRecommendationContext {
  solutionTitle: string;
  solutionDescription: string;
  interventionType: string;
  efficiencyLevel: string;
  equityIndex: number;
  cost: number;
  impact: number;
  rationale?: string;
  sourceStudy?: string | null;
}

export interface AssistantChatFeatureContext {
  name: string;
  address: string;
  barangay: string;
  hazards?: {
    flood?: { id: string; level: number | null }[];
    storm?: { id: string; level: number | null }[];
    air?: { AQI_Level?: number }[];
  };
}

export interface AssistantChatBarangayContext {
  name: string;
  greeneryIndex: number;
  ndvi: number;
  lst: number;
  treeCanopy: number;
  greeneryLevel?: string;
  aqi?: number;
  floodExposure: string;
  currentIntervention: string;
}

export interface AssistantChatRequest {
  messages: AssistantMessagePayload[];
  recommendation: AssistantChatRecommendationContext;
  selectedFeature: AssistantChatFeatureContext;
  selectedBarangayData?: AssistantChatBarangayContext | null;
}

export interface AssistantChatResponse {
  reply: string;
  mode: "grounded" | "general";
  sources: AssistantSource[];
  query?: string;
}

export type TechnicalPhaseHint =
  | "planning"
  | "legal"
  | "procurement"
  | "construction"
  | "operations";

export interface TechnicalConsideration {
  title: string;
  detail: string;
  phaseHint: TechnicalPhaseHint;
  sourceStudy?: string | null;
}

export interface CostLineItem {
  category:
    | "materials"
    | "labor"
    | "permits"
    | "maintenance"
    | "contingency"
    | "other";
  label: string;
  estimatedCost: number;
  rationale?: string;
  sourceStudy?: string | null;
}

export interface CostMarketReference {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  locality?: string;
}
