import { isFiniteNumber, canopyFraction01, clamp01, clampDelta } from "./site-analysis";

export type InterventionScoringContext = {
  areaName?: string | null;
  ndvi?: number | null;
  lst?: number | null;
  treeCanopy?: number | null;
  greeneryIndex?: number | null;
  greeneryLevel?: string | null;
  floodHazard?: number | null;
  stormHazard?: number | null;
  aqi?: number | null;
  taggedTreeCount?: number | null;
  inventoryCanopyFraction?: number | null;
  areaHectares?: number | null;
  visionContext?: VisionScoringContext | null;
};

export type VisionScoringContext = {
  groundOpenSpaceLevel: "LOW" | "MEDIUM" | "HIGH";
  buildingDensityLevel: "LOW" | "MEDIUM" | "HIGH";
  roofGreeningPotential: "LOW" | "MEDIUM" | "HIGH";
  verticalGreeningPotential: "LOW" | "MEDIUM" | "HIGH";
  soilVisibility: "NONE" | "LIMITED" | "CLEAR";
  permeabilityHint: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  confidence: number;
  rationale: string;
};

export type InterventionRecordLike = {
  name?: string | null;
  interventionType?: string | null;
  description?: string | null;
  summary?: string | null;
  recommendationID?: string | null;
  relevancy?: number | null;
  feasibility?: number | null;
  impact?: number | null;
  priority?: string | null;
};

export type InterventionPlanningSignals = {
  canopyFraction?: number;
  hasHighCanopy: boolean;
  hasVeryHighCanopy: boolean;
  hasGreenDeficit: boolean;
  hasHeatStress: boolean;
  hasSevereHeat: boolean;
  hasFloodPressure: boolean;
  hasSevereFloodPressure: boolean;
  hasStormPressure: boolean;
  hasPoorAirQuality: boolean;
  hasHighTreeInventory: boolean;
  likelyTightGround: boolean;
  inferredTightGround: boolean;
  hasLowGroundOpenSpace: boolean;
  hasHighBuildingDensity: boolean;
  hasHighRoofPotential: boolean;
  hasHighVerticalPotential: boolean;
  hasLowPermeabilityHint: boolean;
  hasHighPermeabilityHint: boolean;
  isSmallArea: boolean;
  isLargeArea: boolean;
};

export type InterventionClassification = {
  isBroadTreePlanting: boolean;
  isTargetedTreePlanting: boolean;
  isStewardship: boolean;
  isUnderstoryOrShrub: boolean;
  isEnvelopeGreening: boolean;
  isStormwater: boolean;
  isGreenCorridor: boolean;
  isPocketOrCommunity: boolean;
  isPermeableOrCoolSurface: boolean;
  isCoastalOrRiparian: boolean;
  isBufferPlanting: boolean;
};

export type InterventionFitAdjustment = {
  relevancyDelta: number;
  feasibilityDelta: number;
  impactDelta: number;
  priority?: "high" | "medium" | "low";
};

/**
 * Distinct site challenges a planner would try to alleviate. Ordered by
 * how aggressively they should bias intervention selection (severity is the
 * "if this is the biggest problem on site, how much should the recommendation
 * lean toward fixing it" dial, not a numeric hazard rating).
 */
export type PlanningChallenge =
  | "severe-flooding"
  | "flooding"
  | "storm-exposure"
  | "severe-heat"
  | "heat-stress"
  | "poor-air-quality"
  | "green-deficit"
  | "tight-ground";

export type ChallengeAssessment = {
  challenge: PlanningChallenge;
  /** 0–1 weight used to scale the bonus this challenge applies to scoring. */
  severity: number;
  /** Short human-readable label, e.g. "Severe flood exposure". */
  label: string;
  /** One-line rationale referencing the underlying signal. */
  rationale: string;
};

const CHALLENGE_LABELS: Record<PlanningChallenge, string> = {
  "severe-flooding": "Severe flood exposure",
  flooding: "Flood pressure",
  "storm-exposure": "Storm / surge exposure",
  "severe-heat": "Severe heat stress",
  "heat-stress": "Heat stress",
  "poor-air-quality": "Poor air quality",
  "green-deficit": "Green deficit",
  "tight-ground": "Built-up / limited ground space",
};

function finiteNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

export function analyzeInterventionContext(
  context: InterventionScoringContext,
): InterventionPlanningSignals {
  const canopyFraction = canopyFraction01(context.treeCanopy);
  const inventoryCanopyFraction = canopyFraction01(context.inventoryCanopyFraction);
  const ndvi = finiteNumber(context.ndvi);
  const lst = finiteNumber(context.lst);
  const gi = finiteNumber(context.greeneryIndex);
  const floodHazard = finiteNumber(context.floodHazard);
  const stormHazard = finiteNumber(context.stormHazard);
  const aqi = finiteNumber(context.aqi);
  const taggedTreeCount = finiteNumber(context.taggedTreeCount) ?? 0;
  const areaHectares = finiteNumber(context.areaHectares);
  const level = (context.greeneryLevel ?? "").trim();

  const hasHighCanopy =
    (canopyFraction !== undefined && canopyFraction >= 0.4) ||
    (gi !== undefined && gi >= 0.62) ||
    /^(High|Very High)$/i.test(level);
  const hasVeryHighCanopy =
    (canopyFraction !== undefined && canopyFraction >= 0.58) ||
    (gi !== undefined && gi >= 0.72) ||
    /^Very High$/i.test(level);
  const hasGreenDeficit =
    (canopyFraction !== undefined && canopyFraction < 0.22) ||
    (ndvi !== undefined && ndvi < 0.28) ||
    (gi !== undefined && gi < 0.42);
  const hasHeatStress = lst !== undefined && lst >= 33;
  const hasSevereHeat = lst !== undefined && lst >= 36;
  const hasFloodPressure = floodHazard !== undefined && floodHazard >= 2;
  const hasSevereFloodPressure = floodHazard !== undefined && floodHazard >= 3;
  const hasStormPressure = stormHazard !== undefined && stormHazard >= 2;
  const hasPoorAirQuality = aqi !== undefined && aqi > 100;
  const hasHighTreeInventory =
    (inventoryCanopyFraction !== undefined && inventoryCanopyFraction >= 0.3) ||
    (taggedTreeCount >= 10 && (canopyFraction ?? 0) >= 0.25);
  const isSmallArea = areaHectares !== undefined && areaHectares > 0 && areaHectares < 5;
  const isLargeArea = areaHectares !== undefined && areaHectares >= 50;

  // No building-footprint layer is available. This is only a fallback heuristic:
  // hot + green-poor sites, especially small selections, often have tighter
  // ground opportunities and need envelope/pocket options to score higher.
  const inferredTightGround =
    hasHeatStress &&
    hasGreenDeficit &&
    (isSmallArea ||
      (areaHectares === undefined &&
        ((canopyFraction !== undefined && canopyFraction < 0.18) ||
          (gi !== undefined && gi < 0.35))));

  const vision = context.visionContext;
  const hasVision = !!vision && vision.confidence >= 0.35;
  const hasLowGroundOpenSpace =
    hasVision && vision.groundOpenSpaceLevel === "LOW";
  const hasHighBuildingDensity =
    hasVision && vision.buildingDensityLevel === "HIGH";
  const hasHighRoofPotential =
    hasVision && vision.roofGreeningPotential === "HIGH";
  const hasHighVerticalPotential =
    hasVision && vision.verticalGreeningPotential === "HIGH";
  const hasLowPermeabilityHint =
    hasVision && vision.permeabilityHint === "LOW";
  const hasHighPermeabilityHint =
    hasVision && vision.permeabilityHint === "HIGH";
  const likelyTightGround =
    hasLowGroundOpenSpace ||
    hasHighBuildingDensity ||
    hasHighRoofPotential ||
    hasHighVerticalPotential ||
    (!hasVision && inferredTightGround);

  return {
    canopyFraction,
    hasHighCanopy,
    hasVeryHighCanopy,
    hasGreenDeficit,
    hasHeatStress,
    hasSevereHeat,
    hasFloodPressure,
    hasSevereFloodPressure,
    hasStormPressure,
    hasPoorAirQuality,
    hasHighTreeInventory,
    likelyTightGround,
    inferredTightGround,
    hasLowGroundOpenSpace,
    hasHighBuildingDensity,
    hasHighRoofPotential,
    hasHighVerticalPotential,
    hasLowPermeabilityHint,
    hasHighPermeabilityHint,
    isSmallArea,
    isLargeArea,
  };
}

// ---------------------------------------------------------------------------
// Classification vocabulary — data-driven regex table
// ---------------------------------------------------------------------------

type ClassificationPattern = {
  key: Extract<
    keyof InterventionClassification,
    | "isStewardship"
    | "isUnderstoryOrShrub"
    | "isEnvelopeGreening"
    | "isStormwater"
    | "isGreenCorridor"
    | "isPocketOrCommunity"
    | "isPermeableOrCoolSurface"
    | "isCoastalOrRiparian"
    | "isBufferPlanting"
  >;
  patterns: RegExp[];
};

/**
 * Simple regex-to-flag mapping. Each entry's `patterns` are OR'd over the
 * joined lowercased recommendation text. Adding a new classification = adding
 * an entry here (plus a boolean field on `InterventionClassification`).
 */
const CLASSIFICATION_VOCABULARY: ClassificationPattern[] = [
  {
    key: "isStewardship",
    patterns: [/steward/, /maint/, /prun/, /care/, /preserv/, /protect/],
  },
  {
    key: "isUnderstoryOrShrub",
    patterns: [
      /understory/,
      /understorey/,
      /shrub/,
      /ground\s*cover/,
      /shade[-\s]*tolerant/,
    ],
  },
  {
    key: "isEnvelopeGreening",
    patterns: [
      /roof/,
      /rooftop/,
      /green\s*wall/,
      /vertical/,
      /facade/,
      /façade/,
      /balcony/,
      /envelope/,
    ],
  },
  {
    key: "isStormwater",
    patterns: [
      /rain\s*garden/,
      /bioswale/,
      /bio\s*swale/,
      /stormwater/,
      /retention/,
      /detention/,
      /drain/,
      /flood/,
      /infiltration/,
    ],
  },
  {
    key: "isGreenCorridor",
    patterns: [
      /corridor/,
      /greenway/,
      /linear/,
      /streetscape/,
      /cool\s*route/,
      /blue[-\s]*green/,
    ],
  },
  {
    key: "isPocketOrCommunity",
    patterns: [
      /pocket/,
      /parklet/,
      /community\s*garden/,
      /courtyard/,
      /vacant\s*lot/,
      /micro\s*park/,
    ],
  },
  {
    key: "isPermeableOrCoolSurface",
    patterns: [
      /permeable/,
      /porous/,
      /pavement/,
      /cool\s*surface/,
      /albedo/,
      /depav/,
    ],
  },
  {
    key: "isCoastalOrRiparian",
    patterns: [
      /coastal/,
      /riparian/,
      /mangrove/,
      /river/,
      /shore/,
      /surge/,
      /buffer/,
    ],
  },
  {
    key: "isBufferPlanting",
    patterns: [
      /buffer/,
      /pollution/,
      /particulate/,
      /roadside/,
      /traffic/,
    ],
  },
];

const TREE_PATTERNS = [
  /tree/,
  /canopy/,
  /urban\s*forest/,
  /street\s*planting/,
  /planting\s*campaign/,
] as const;

const TARGETED_PATTERNS = [
  /target/,
  /infill/,
  /gap/,
  /verge/,
  /median/,
  /selective/,
] as const;

export function classifyIntervention(
  rec: InterventionRecordLike,
): InterventionClassification {
  const text = [
    rec.name,
    rec.interventionType,
    rec.description,
    rec.summary,
    rec.recommendationID,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // First pass: simple regex-to-flag mapping
  const flags: Record<string, boolean> = {};
  for (const entry of CLASSIFICATION_VOCABULARY) {
    flags[entry.key] = entry.patterns.some((p) => p.test(text));
  }

  // Second pass: computed flags that depend on the first-pass results
  const hasTreeLanguage = TREE_PATTERNS.some((p) => p.test(text));
  const isTargetedTreePlanting =
    hasTreeLanguage && TARGETED_PATTERNS.some((p) => p.test(text));
  const isBroadTreePlanting =
    hasTreeLanguage &&
    !isTargetedTreePlanting &&
    !flags.isStewardship &&
    !flags.isUnderstoryOrShrub &&
    !flags.isEnvelopeGreening &&
    !flags.isStormwater;

  return {
    isBroadTreePlanting,
    isTargetedTreePlanting,
    isStewardship: flags.isStewardship,
    isUnderstoryOrShrub: flags.isUnderstoryOrShrub,
    isEnvelopeGreening: flags.isEnvelopeGreening,
    isStormwater: flags.isStormwater,
    isGreenCorridor: flags.isGreenCorridor,
    isPocketOrCommunity: flags.isPocketOrCommunity,
    isPermeableOrCoolSurface: flags.isPermeableOrCoolSurface,
    isCoastalOrRiparian: flags.isCoastalOrRiparian,
    isBufferPlanting: flags.isBufferPlanting,
  };
}

/**
 * Walk the site signals and surface the planning challenges that need to be
 * alleviated, ordered from most to least severe. The first entry is the
 * "biggest issue in the area" — recommendations should lead with whatever
 * intervention most directly addresses it.
 */
export function identifyPrimaryChallenges(
  signals: InterventionPlanningSignals,
): ChallengeAssessment[] {
  const out: ChallengeAssessment[] = [];

  if (signals.hasSevereFloodPressure) {
    out.push({
      challenge: "severe-flooding",
      severity: 1.0,
      label: CHALLENGE_LABELS["severe-flooding"],
      rationale: "Flood hazard at the highest tier",
    });
  } else if (signals.hasFloodPressure) {
    out.push({
      challenge: "flooding",
      severity: 0.78,
      label: CHALLENGE_LABELS.flooding,
      rationale: "Elevated flood hazard",
    });
  }

  if (signals.hasSevereHeat) {
    out.push({
      challenge: "severe-heat",
      severity: 0.95,
      label: CHALLENGE_LABELS["severe-heat"],
      rationale: "Land surface temperature in the severe range (≥36°C)",
    });
  } else if (signals.hasHeatStress) {
    out.push({
      challenge: "heat-stress",
      severity: 0.72,
      label: CHALLENGE_LABELS["heat-stress"],
      rationale: "Elevated land surface temperature (≥33°C)",
    });
  }

  if (signals.hasStormPressure) {
    out.push({
      challenge: "storm-exposure",
      severity: 0.85,
      label: CHALLENGE_LABELS["storm-exposure"],
      rationale: "High storm or surge exposure",
    });
  }

  if (signals.hasPoorAirQuality) {
    out.push({
      challenge: "poor-air-quality",
      severity: 0.66,
      label: CHALLENGE_LABELS["poor-air-quality"],
      rationale: "AQI above the unhealthy threshold",
    });
  }

  if (signals.hasGreenDeficit) {
    out.push({
      challenge: "green-deficit",
      severity: 0.6,
      label: CHALLENGE_LABELS["green-deficit"],
      rationale: "Low canopy / NDVI / GI indicates a green deficit",
    });
  }

  if (signals.likelyTightGround) {
    out.push({
      challenge: "tight-ground",
      severity: 0.5,
      label: CHALLENGE_LABELS["tight-ground"],
      rationale: "Built-up context likely limits ground-based options",
    });
  }

  return out.sort((a, b) => b.severity - a.severity);
}

/**
 * 0–1 score for how strongly a given intervention classification alleviates
 * the supplied challenge. 1.0 = a textbook fit, 0.5 = neutral, < 0.4 = a
 * weak match planners would typically not lead with.
 */
export function classificationAlleviates(
  classification: InterventionClassification,
  challenge: PlanningChallenge,
): number {
  switch (challenge) {
    case "severe-flooding":
      if (classification.isStormwater) return 1.0;
      if (classification.isCoastalOrRiparian) return 0.9;
      if (classification.isPermeableOrCoolSurface) return 0.85;
      if (classification.isGreenCorridor) return 0.6;
      if (classification.isPocketOrCommunity) return 0.4;
      return classification.isBroadTreePlanting ||
        classification.isTargetedTreePlanting
        ? 0.32
        : 0.2;
    case "flooding":
      if (classification.isStormwater) return 0.95;
      if (classification.isPermeableOrCoolSurface) return 0.82;
      if (classification.isCoastalOrRiparian) return 0.78;
      if (classification.isGreenCorridor) return 0.7;
      if (classification.isPocketOrCommunity) return 0.5;
      return classification.isBroadTreePlanting ||
        classification.isTargetedTreePlanting
        ? 0.5
        : 0.3;
    case "storm-exposure":
      if (classification.isCoastalOrRiparian) return 1.0;
      if (classification.isBufferPlanting) return 0.7;
      if (classification.isGreenCorridor) return 0.65;
      if (classification.isStormwater) return 0.55;
      return 0.3;
    case "severe-heat":
      if (classification.isBroadTreePlanting) return 0.95;
      if (classification.isTargetedTreePlanting) return 0.92;
      if (classification.isGreenCorridor) return 0.85;
      if (classification.isEnvelopeGreening) return 0.7;
      if (classification.isPocketOrCommunity) return 0.66;
      if (classification.isPermeableOrCoolSurface) return 0.5;
      if (classification.isUnderstoryOrShrub) return 0.45;
      return 0.32;
    case "heat-stress":
      if (classification.isBroadTreePlanting) return 0.9;
      if (classification.isTargetedTreePlanting) return 0.88;
      if (classification.isGreenCorridor) return 0.82;
      if (classification.isEnvelopeGreening) return 0.66;
      if (classification.isPocketOrCommunity) return 0.6;
      if (classification.isPermeableOrCoolSurface) return 0.48;
      if (classification.isUnderstoryOrShrub) return 0.45;
      return 0.36;
    case "poor-air-quality":
      if (classification.isBufferPlanting) return 0.95;
      if (classification.isGreenCorridor) return 0.85;
      if (classification.isTargetedTreePlanting) return 0.82;
      if (classification.isBroadTreePlanting) return 0.78;
      if (classification.isUnderstoryOrShrub) return 0.55;
      if (classification.isEnvelopeGreening) return 0.5;
      return 0.38;
    case "green-deficit":
      if (classification.isPocketOrCommunity) return 0.9;
      if (classification.isBroadTreePlanting) return 0.88;
      if (classification.isTargetedTreePlanting) return 0.85;
      if (classification.isGreenCorridor) return 0.78;
      if (classification.isUnderstoryOrShrub) return 0.65;
      if (classification.isEnvelopeGreening) return 0.55;
      if (classification.isCoastalOrRiparian) return 0.5;
      return 0.4;
    case "tight-ground":
      if (classification.isEnvelopeGreening) return 1.0;
      if (classification.isPocketOrCommunity) return 0.72;
      if (classification.isUnderstoryOrShrub) return 0.6;
      if (classification.isPermeableOrCoolSurface) return 0.55;
      return 0.25;
    default:
      return 0.4;
  }
}

export function formatChallengeForPrompt(c: ChallengeAssessment): string {
  return `${c.label} — ${c.rationale}`;
}

export function scoreInterventionFit(
  classification: InterventionClassification,
  signals: InterventionPlanningSignals,
): InterventionFitAdjustment {
  let relevancyDelta = 0;
  let feasibilityDelta = 0;
  let impactDelta = 0;

  if (classification.isBroadTreePlanting) {
    if (signals.hasHighTreeInventory) {
      relevancyDelta -= 0.35;
      feasibilityDelta -= 0.2;
      impactDelta -= 0.15;
    } else if (signals.hasVeryHighCanopy) {
      relevancyDelta -= 0.3;
      feasibilityDelta -= 0.14;
      impactDelta -= 0.12;
    } else if (signals.hasHighCanopy) {
      relevancyDelta -= 0.22;
      feasibilityDelta -= 0.1;
      impactDelta -= 0.08;
    }

    if (signals.hasHeatStress && signals.hasGreenDeficit && !signals.likelyTightGround) {
      relevancyDelta += signals.hasSevereHeat ? 0.24 : 0.18;
      impactDelta += 0.14;
      feasibilityDelta += 0.04;
    }
    if (signals.hasLowGroundOpenSpace || signals.hasHighBuildingDensity) {
      relevancyDelta -= 0.2;
      feasibilityDelta -= 0.24;
    } else if (signals.likelyTightGround) {
      relevancyDelta -= 0.14;
      feasibilityDelta -= 0.2;
    }
    if (signals.hasSevereFloodPressure) {
      relevancyDelta -= 0.08;
    }
  }

  if (classification.isTargetedTreePlanting) {
    if (signals.hasHeatStress) relevancyDelta += 0.12;
    if (signals.hasGreenDeficit) impactDelta += 0.1;
    if (signals.hasHighTreeInventory || signals.hasHighCanopy) {
      // Targeted infill is still a creation pathway in already-greened areas
      // (filling gaps, shade equity, corridor continuity). Keep it ranked
      // above stewardship/maintenance even when a site looks green overall.
      relevancyDelta += 0.06;
    }
    if (signals.likelyTightGround) feasibilityDelta -= 0.06;
  }

  if (classification.isStewardship) {
    // Stewardship/maintenance is a "do less" posture, not a way to add new
    // greenery. It can still be a valid co-recommendation, but per planning
    // policy it must rank below creation-oriented interventions of comparable
    // contextual fit.
    if (signals.hasHighTreeInventory || signals.hasHighCanopy) {
      relevancyDelta += 0.08;
      feasibilityDelta += 0.06;
      impactDelta += 0.02;
    }
    // Baseline demotion so stewardship never beats creation interventions on
    // overall fit, regardless of how the AI initially scored it.
    relevancyDelta -= 0.06;
    impactDelta -= 0.04;
  }

  if (classification.isUnderstoryOrShrub) {
    if (signals.hasHighCanopy || signals.hasHighTreeInventory) {
      relevancyDelta += 0.18;
      feasibilityDelta += 0.12;
    }
    if (signals.likelyTightGround) relevancyDelta += 0.08;
  }

  if (classification.isEnvelopeGreening) {
    if (
      signals.hasHighRoofPotential ||
      signals.hasHighVerticalPotential ||
      signals.hasHighBuildingDensity
    ) {
      relevancyDelta += 0.34;
      feasibilityDelta += 0.2;
    } else if (signals.likelyTightGround) {
      relevancyDelta += 0.28;
      feasibilityDelta += 0.18;
    }
    if (signals.hasHeatStress) {
      relevancyDelta += 0.1;
      impactDelta += 0.08;
    }
    if (signals.hasHighCanopy) relevancyDelta += 0.06;
  }

  if (classification.isStormwater) {
    if (signals.hasFloodPressure) {
      relevancyDelta += signals.hasSevereFloodPressure ? 0.24 : 0.18;
      impactDelta += 0.1;
      feasibilityDelta += 0.05;
    } else {
      relevancyDelta -= 0.05;
    }
    if (signals.hasLowPermeabilityHint) {
      feasibilityDelta -= 0.08;
      relevancyDelta -= 0.04;
    } else if (signals.hasHighPermeabilityHint) {
      feasibilityDelta += 0.06;
      relevancyDelta += 0.05;
    }
  }

  if (classification.isGreenCorridor) {
    if (signals.hasHeatStress && signals.hasFloodPressure) relevancyDelta += 0.24;
    else if (signals.hasHeatStress || signals.hasFloodPressure) relevancyDelta += 0.12;
    if (signals.hasHighCanopy && signals.hasHeatStress) relevancyDelta += 0.1;
    if (signals.isLargeArea) feasibilityDelta += 0.06;
  }

  if (classification.isPocketOrCommunity) {
    if (signals.hasGreenDeficit) relevancyDelta += 0.12;
    if (signals.likelyTightGround || signals.isSmallArea) feasibilityDelta += 0.12;
    if (signals.hasHeatStress) impactDelta += 0.06;
  }

  if (classification.isPermeableOrCoolSurface) {
    if (signals.hasHeatStress) relevancyDelta += 0.12;
    if (signals.hasFloodPressure) relevancyDelta += 0.12;
    if (signals.likelyTightGround) feasibilityDelta += 0.08;
    if (signals.hasLowPermeabilityHint) {
      feasibilityDelta -= 0.1;
      relevancyDelta -= 0.06;
    } else if (signals.hasHighPermeabilityHint) {
      feasibilityDelta += 0.08;
      impactDelta += 0.06;
    }
  }

  if (classification.isCoastalOrRiparian && (signals.hasStormPressure || signals.hasFloodPressure)) {
    relevancyDelta += 0.22;
    impactDelta += 0.1;
  }

  if (
    signals.hasPoorAirQuality &&
    (classification.isBufferPlanting ||
      classification.isGreenCorridor ||
      classification.isTargetedTreePlanting)
  ) {
    relevancyDelta += 0.1;
    impactDelta += 0.08;
  }

  // Primary-challenge bonus: bias toward what directly alleviates the biggest
  // issue, but keep it modest so impact, cost, and feasibility can still
  // change the top recommendation. Stewardship is excluded because it is a
  // maintenance posture, not hazard remediation.
  const challenges = identifyPrimaryChallenges(signals);
  if (challenges.length > 0 && !classification.isStewardship) {
    const primary = challenges[0];
    const primaryFit = classificationAlleviates(classification, primary.challenge);
    const primaryAdj = (primaryFit - 0.5) * 0.24 * primary.severity;
    relevancyDelta += primaryAdj;
    if (primaryAdj > 0) impactDelta += primaryAdj * 0.25;

    if (challenges.length >= 2) {
      const secondary = challenges[1];
      const secondaryFit = classificationAlleviates(classification, secondary.challenge);
      relevancyDelta += (secondaryFit - 0.5) * 0.1 * secondary.severity;
    }
  }

  let priority: "high" | "medium" | "low" | undefined =
    relevancyDelta >= 0.22
      ? "high"
      : relevancyDelta <= -0.22
        ? "low"
        : undefined;

  // Hard rule: stewardship/maintenance can never be the headline action when
  // the site has any creation need (deficit, heat, flood, storm). Demote so
  // the priority label matches the lowered overall fit.
  if (
    classification.isStewardship &&
    (signals.hasGreenDeficit ||
      signals.hasSevereHeat ||
      signals.hasFloodPressure ||
      signals.hasStormPressure)
  ) {
    priority = "low";
  }

  return {
    relevancyDelta: clampDelta(relevancyDelta, -0.45, 0.45),
    feasibilityDelta: clampDelta(feasibilityDelta, -0.3, 0.3),
    impactDelta: clampDelta(impactDelta, -0.25, 0.25),
    priority,
  };
}

export function adjustRecommendationForContext<T extends InterventionRecordLike>(
  rec: T,
  context: InterventionScoringContext,
): T {
  const signals = analyzeInterventionContext(context);
  const classification = classifyIntervention(rec);
  const adjustment = scoreInterventionFit(classification, signals);
  const nextPriority =
    adjustment.priority === "high" && rec.priority !== "high"
      ? "high"
      : adjustment.priority === "low" && rec.priority === "high"
        ? "medium"
        : (adjustment.priority ?? rec.priority);

  return {
    ...rec,
    relevancy: clamp01((rec.relevancy ?? 0.5) + adjustment.relevancyDelta),
    feasibility: clamp01((rec.feasibility ?? 0.5) + adjustment.feasibilityDelta),
    impact: clamp01((rec.impact ?? 0.5) + adjustment.impactDelta),
    priority: nextPriority ?? rec.priority,
  };
}
