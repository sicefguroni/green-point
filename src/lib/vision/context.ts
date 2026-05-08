import { z } from "zod";

export const visionLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const soilVisibilitySchema = z.enum(["NONE", "LIMITED", "CLEAR"]);
export const permeabilityHintSchema = z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);

export const visionContextSchema = z.object({
  groundOpenSpaceLevel: visionLevelSchema,
  buildingDensityLevel: visionLevelSchema,
  roofGreeningPotential: visionLevelSchema,
  verticalGreeningPotential: visionLevelSchema,
  soilVisibility: soilVisibilitySchema,
  permeabilityHint: permeabilityHintSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(280),
});

export type VisionContext = z.infer<typeof visionContextSchema>;

export const visionAnalysisSchema = z.object({
  visionContext: visionContextSchema,
  quickTags: z.array(z.string().min(1).max(48)).max(12).default([]),
});

export type VisionAnalysisResult = z.infer<typeof visionAnalysisSchema>;

export const VISION_CONFIDENCE_THRESHOLD = 0.35;

export function normalizeVisionAnalysis(
  raw: unknown,
): VisionAnalysisResult | null {
  const parsed = visionAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export function shouldUseVisionContext(
  visionContext: VisionContext | null | undefined,
): visionContext is VisionContext {
  return (
    !!visionContext &&
    Number.isFinite(visionContext.confidence) &&
    visionContext.confidence >= VISION_CONFIDENCE_THRESHOLD
  );
}
