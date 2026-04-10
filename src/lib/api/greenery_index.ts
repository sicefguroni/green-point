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
  vegetation: 0.35,
  thermal: 0.25,
  canopy: 0.25,
  greenArea: 0.15,
};

function normalizeNdvi(ndvi: number): number {
  return Math.min(1, Math.max(0, (ndvi + 0.1) / 1.0));
}

function normalizeLst(lst: number): number {
  const minTemp = 20;
  const maxTemp = 45;
  const clamped = Math.min(maxTemp, Math.max(minTemp, lst));
  return 1 - (clamped - minTemp) / (maxTemp - minTemp);
}

function normalizeCanopy(canopy: number): number {
  return Math.min(1, Math.max(0, canopy));
}

function normalizeGreenArea(greenArea: number): number {
  return Math.min(1, Math.max(0, greenArea));
}

function getLevel(gi: number): string {
  if (gi >= 0.75) return "Very High";
  if (gi >= 0.55) return "High";
  if (gi >= 0.35) return "Medium";
  if (gi >= 0.15) return "Low";
  return "Very Low";
}

export function calculateGreeneryIndex(metrics: GreeneryMetrics): GreeneryIndexResult {
  const vegetationScore = normalizeNdvi(metrics.ndvi);
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
    metrics,
    breakdown: { vegetationScore, thermalScore, canopyScore, greenAreaScore },
  };
}

export function estimateTreeCanopy(ndvi: number, lst: number): number {
  const ndviFactor = Math.max(0, (ndvi - 0.2) / 0.6);
  const tempPenalty = lst > 35 ? 0.1 : lst > 30 ? 0.05 : 0;
  return parseFloat(Math.min(1, Math.max(0, ndviFactor * 0.85 - tempPenalty)).toFixed(3));
}

export function estimateGreenArea(ndvi: number, areaKm2: number): number {
  const greenFraction = Math.max(0, (ndvi - 0.1) / 0.7);
  return parseFloat((greenFraction * areaKm2).toFixed(3));
}
