import type { ReactNode } from "react";

/** Which panel the left sidebar is showing */
export type SidebarView = "LIST" | "DETAIL";

/** Which tab is active inside the Detail panel */
export type DetailTab = "INFO" | "CHAT";

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
}
