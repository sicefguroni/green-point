export type ChatApiRole = "user" | "assistant";

export interface ChatApiMessage {
  role: ChatApiRole;
  content: string;
}

export interface ChatRecommendationContext {
  id?: string;
  recommendationId?: string;
  title: string;
  description: string;
  interventionType?: string | null;
  efficiencyLevel?: string | null;
  efficiencyScore?: number | null;
  equityIndex?: number | null;
  costIndex?: number | null;
  impactScore?: number | null;
  estimatedCost?: number | null;
  costUnit?: string | null;
}

export interface ChatFeatureContext {
  name: string;
  address: string;
  barangay?: string | null;
  coords: {
    lng: number;
    lat: number;
  };
  hazardSummary?: {
    floodLevels?: number[];
    stormLevels?: number[];
    airQualityCount?: number;
  };
}

export interface ChatBarangayContext {
  name: string;
  greeneryIndex: number;
  ndvi: number;
  lst: number;
  treeCanopy: number;
  floodExposure: string;
  currentIntervention: string;
}

export interface ChatRequestPayload {
  messages: ChatApiMessage[];
  recommendation: ChatRecommendationContext;
  selectedFeature: ChatFeatureContext;
  selectedBarangayData?: ChatBarangayContext | null;
}

export interface ChatResponsePayload {
  reply: string;
  error?: string;
}