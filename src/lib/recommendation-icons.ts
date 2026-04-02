/**
 * Mapping of recommendation IDs/names to their Lucide React icons
 * Keeps UI concerns separate from data schema
 */

import {
  Trees,
  Flower,
  Cookie,
  ImageIcon,
  Sprout,
  Zap,
  Droplet,
  Wind,
  type LucideIcon,
} from "lucide-react";

export const recommendationIconMap: Record<string, LucideIcon> = {
  "street-trees": Trees,
  "roof-gardens": Flower,
  "blue-green-corridors": Cookie,
  "photo-monitoring": ImageIcon,
  "green-walls": Sprout,
  "solar-trees": Zap,
  "rain-gardens": Droplet,
  "pollinator-habitats": Wind,
};

/**
 * Get the Lucide icon component for a recommendation
 * Falls back to a default icon if not found
 */
export function getRecommendationIcon(
  recommendationId: string,
  fallback: LucideIcon = Trees
): LucideIcon {
  return recommendationIconMap[recommendationId] || fallback;
}
