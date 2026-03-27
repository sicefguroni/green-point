import type { ReactNode } from "react";

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

/** A single green intervention recommendation */
export interface GreenRecommendation {
  id: string;
  solutionTitle: string;
  solutionDescription: string;
  detailedDescription: string;
  efficiencyLevel: "Highly Efficient" | "Moderately Efficient" | "Not Efficient";
  /** Lucide-React element rendered as the card icon */
  icon: ReactNode;
  /** 0–100 score used by the HalfCircleBar */
  value: number;
  /** 0–1 equity index */
  equityIndex: number;
  /** 0–1 cost index (lower = cheaper) */
  cost: number;
  /** 0–1 impact score */
  impact: number;
  /** Cost estimate details (optional) */
  costEstimate?: CostEstimate;
}
