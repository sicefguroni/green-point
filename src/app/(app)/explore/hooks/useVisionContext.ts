"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import type { VisionContext } from "@/lib/vision/context";
import { buildVisionLegendConfig } from "@/lib/vision/visualization";
import type { LegendConfig } from "@/components/map/map_legend";

/**
 * Manages vision analysis state — photo upload, EXIF extraction, vision
 * context fetching, and derived legend configurations.
 */
export function useVisionContext() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [visionContext, setVisionContext] = useState<VisionContext | null>(null);
  const [visionTags, setVisionTags] = useState<string[]>([]);
  const [visionStatusMessage, setVisionStatusMessage] = useState<
    string | null
  >(null);
  const [isVisionAnalyzing, setIsVisionAnalyzing] = useState(false);
  const [showWarning, setShowWarning] = useState<
    "no-gps" | "out-of-bounds" | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasUsableVisionContext =
    !!visionContext && visionContext.confidence >= 0.35;

  const visionSupplementalLegends = useMemo((): LegendConfig[] => {
    if (!imageUrl || !hasUsableVisionContext || !visionContext) {
      return [];
    }
    return [buildVisionLegendConfig(visionContext)];
  }, [imageUrl, hasUsableVisionContext, visionContext]);

  const clearVisionState = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setVisionContext(null);
    setVisionTags([]);
    setVisionStatusMessage(null);
    setIsVisionAnalyzing(false);
    setShowWarning(null);
  }, [imageUrl]);

  return {
    imageUrl,
    setImageUrl,
    visionContext,
    setVisionContext,
    visionTags,
    setVisionTags,
    visionStatusMessage,
    setVisionStatusMessage,
    isVisionAnalyzing,
    setIsVisionAnalyzing,
    showWarning,
    setShowWarning,
    fileInputRef,
    hasUsableVisionContext,
    visionSupplementalLegends,
    clearVisionState,
  } as const;
}
