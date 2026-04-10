/**
 * UI-specific types for green solutions components
 * Data models are in @/types/schema.ts (GreeningRecommendation)
 */

/** Which panel the left sidebar is showing */
export type SidebarView = "LIST" | "DETAIL";

/** Which tab is active inside the Detail panel */
export type DetailTab = "INFO" | "CHAT" | "TIMELINE";

/** Which timeline visualization is active inside the timeline tab */
export type TimelineViewMode = "DEFAULT" | "GANTT" | "PDF";

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
