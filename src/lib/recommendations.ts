/**
 * Utility functions for working with recommendations
 * Bridges between schema (GreeningRecommendation) and UI concerns (icons, display values)
 */

import React from "react";
import { GreeningRecommendation } from "@/types/schema";
import { getRecommendationIcon } from "./recommendation-icons";
import { CostEstimate } from "@/types/green_solutions";

/**
 * UI-enhanced recommendation with icon and display properties
 */
export interface UIRecommendation extends GreeningRecommendation {
  icon: React.ReactNode;
  solutionTitle: string;
  solutionDescription: string;
  detailedDescription: string;
  efficiencyLevel:
    | "Highly Efficient"
    | "Moderately Efficient"
    | "Not Efficient";
  value: number; // 0-100 efficiency display value
  equityIndex: number; // 0-1
  cost: number; // 0-1 normalized cost index
  impact: number; // 0-1 impact score
  costEstimate?: CostEstimate | null;
}

type RecommendationWithEstimate = GreeningRecommendation & {
  costEstimate?: CostEstimate | null;
};

/**
 * Transform a GreeningRecommendation into a UI-ready format with icons and display values
 */
export function enrichRecommendation(
  rec: GreeningRecommendation,
): UIRecommendation {
  const IconComponent = getRecommendationIcon(rec.recommendationID);

  // Determine efficiency level based on efficiency score
  let efficiencyLevel:
    | "Highly Efficient"
    | "Moderately Efficient"
    | "Not Efficient";
  const efficiency = rec.efficiency ?? 0;
  if (efficiency >= 70) {
    efficiencyLevel = "Highly Efficient";
  } else if (efficiency >= 40) {
    efficiencyLevel = "Moderately Efficient";
  } else {
    efficiencyLevel = "Not Efficient";
  }

  return {
    ...rec,
    icon: React.createElement(IconComponent, { size: 40 }),
    solutionTitle: rec.name,
    solutionDescription: rec.description,
    detailedDescription: rec.description, // Use description as detailed unless more detail field added
    efficiencyLevel,
    value: efficiency, // Use efficiency as the 0-100 value
    equityIndex: rec.equity ?? 0, // Normalize to 0-1
    cost: rec.cost ? Math.min(rec.cost / 100000, 1) : 0.5, // Normalize cost to 0-1
    impact: (rec.efficiency ?? 0) / 100, // Derive impact from efficiency
    costEstimate: (rec as RecommendationWithEstimate).costEstimate || null,
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
  return SCHEMA_RECOMMENDATIONS.map(enrichRecommendation);
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
