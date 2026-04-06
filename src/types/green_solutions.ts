/**
 * UI-specific types for green solutions components
 * Data models are in @/types/schema.ts (GreeningRecommendation)
 */

/** Which panel the left sidebar is showing */
export type SidebarView = "LIST" | "DETAIL";

/** Which tab is active inside the Detail panel */
export type DetailTab = "INFO" | "CHAT" | "TIMELINE";

/** Optional AI chat context that can influence timeline planning */
export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
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

/** Cost estimate details for a greening intervention */
export interface CostEstimate {
  interventionType: string;
  basePrice: number;
  totalEstimate: number;
  currencyUnit: string;
  perUnit: string;
  area: number | null;
  locationMultiplier: number;
  breakdown: {
    materials: number;
    labor: number;
    contingency: number;
  };
}
