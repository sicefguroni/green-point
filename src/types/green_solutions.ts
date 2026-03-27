/**
 * UI-specific types for green solutions components
 * Data models are in @/types/schema.ts (GreeningRecommendation)
 */

/** Which panel the left sidebar is showing */
export type SidebarView = "LIST" | "DETAIL";

/** Which tab is active inside the Detail panel */
export type DetailTab = "INFO" | "CHAT";

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
