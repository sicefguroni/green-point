export interface GreeneryMetrics {
  ndvi: number;
  lst: number;
  treeCanopy: number;
  greenArea: number;
}

export interface GreeneryIndexResult {
  greeneryIndex: number;
  level: string;
  metrics: GreeneryMetrics;
  breakdown: {
    vegetationScore: number;
    thermalScore: number;
    canopyScore: number;
    greenAreaScore: number;
  };
}

const WEIGHTS = {
  vegetation: 0.35, // Balanced vegetation weight
  thermal: 0.2,    // Moderate thermal influence
  canopy: 0.3,     // Significant canopy weight
  greenArea: 0.15,
};

function normalizeNdvi(ndvi: number): number {
  // Balanced normalization: 0.1 is barren, 0.9 is perfect
  const clamped = Math.max(0, ndvi);
  return Math.min(1, Math.max(0, (clamped - 0.1) / 0.8));
}

function normalizeLst(lst: number): number {
  const minTemp = 20;
  const maxTemp = 42; 
  const clamped = Math.min(maxTemp, Math.max(minTemp, lst));
  return 1 - (clamped - minTemp) / (maxTemp - minTemp);
}

function normalizeCanopy(canopy: number): number {
  // Conservative normalization: 1.0 is the target for perfect urban cooling
  return Math.min(1, Math.max(0, canopy / 1.0));
}

function normalizeGreenArea(greenArea: number): number {
  return Math.min(1, Math.max(0, greenArea));
}

function getLevel(gi: number): string {
  // Balanced thresholds for realistic urban differentiation
  if (gi >= 0.75) return "Very High";
  if (gi >= 0.55) return "High";
  if (gi >= 0.35) return "Medium";
  if (gi >= 0.15) return "Low";
  return "Very Low";
}

export function calculateGreeneryIndex(
  metrics: GreeneryMetrics,
): GreeneryIndexResult {
  const safeNdvi = Math.max(0, metrics.ndvi);
  const vegetationScore = normalizeNdvi(safeNdvi);
  const thermalScore = normalizeLst(metrics.lst);
  const canopyScore = normalizeCanopy(metrics.treeCanopy);
  const greenAreaScore = normalizeGreenArea(metrics.greenArea);

  const gi = parseFloat(
    (
      WEIGHTS.vegetation * vegetationScore +
      WEIGHTS.thermal * thermalScore +
      WEIGHTS.canopy * canopyScore +
      WEIGHTS.greenArea * greenAreaScore
    ).toFixed(3),
  );

  return {
    greeneryIndex: gi,
    level: getLevel(gi),
    metrics: { ...metrics, ndvi: safeNdvi },
    breakdown: { vegetationScore, thermalScore, canopyScore, greenAreaScore },
  };
}

export function estimateTreeCanopy(ndvi: number, lst: number): number {
  const safeNdvi = Math.max(0, ndvi);
  // Reverted to a more balanced threshold (0.12) to avoid over-inflation
  const ndviFactor = Math.max(0, (safeNdvi - 0.12) / 0.68);
  const tempPenalty = lst > 38 ? 0.06 : lst > 33 ? 0.03 : 0;
  
  // Minimal baseline for vegetation presence
  const baseline = safeNdvi > 0.1 ? 0.01 : 0;
  
  return parseFloat(
    Math.min(1, Math.max(baseline, ndviFactor * 0.8 - tempPenalty)).toFixed(3),
  );
}

export function estimateGreenArea(ndvi: number, areaKm2: number): number {
  const safeNdvi = Math.max(0, ndvi);
  const greenFraction = Math.max(0, (safeNdvi - 0.1) / 0.7);
  return parseFloat((greenFraction * areaKm2).toFixed(3));
}
