export type CostEstimationScope = "project" | "site" | "barangay";

export interface CostEstimateBreakdown {
  materials: number;
  labor: number;
  contingency: number;
  maintenance?: number;
}

export interface CostEstimateInput {
  interventionType: string;
  solutionTitle?: string | null;
  solutionDescription?: string | null;
  areaSqm?: number | null;
  barangayId?: string | null;
  scope?: CostEstimationScope | null;
  greeneryIndex?: number | null;
  floodHazard?: number | null;
  stormHazard?: number | null;
  lifecycleYears?: number | null;
  locationMultiplier?: number | null;
}

export interface CostEstimateResult {
  interventionType: string;
  basePrice: number;
  totalEstimate: number;
  currencyUnit: string;
  perUnit: string;
  area: number | null;
  locationMultiplier: number;
  quantity: number;
  lifecycleYears: number;
  scope: CostEstimationScope;
  breakdown: CostEstimateBreakdown;
  assumptions: string[];
}

export interface CostEstimateAnchor {
  key: string;
  basePrice: number;
  perUnit: string;
}

type AreaMode = "none" | "exact" | "ceil";

type InterventionModel = {
  key: string;
  aliases: string[];
  perUnit: string;
  basePrice: number;
  areaMode: AreaMode;
  referenceAreaSqm: number;
  scaleWithBarangayArea: boolean;
  lifecycleYears: number;
  materialsShare: number;
  laborShare: number;
  maintenanceRate: number;
  notes: string[];
};

const INTERVENTION_MODELS: InterventionModel[] = [
  {
    key: "urban canopy enhancement",
    aliases: [
      "urban canopy enhancement",
      "urban canopy",
      "street trees",
      "street tree planting",
      "canopy",
      "tree planting",
    ],
    perUnit: "per tree",
    basePrice: 5200,
    areaMode: "ceil",
    referenceAreaSqm: 25,
    scaleWithBarangayArea: true,
    lifecycleYears: 5,
    materialsShare: 0.52,
    laborShare: 0.33,
    maintenanceRate: 0.08,
    notes: [
      "Area is translated into a planting density of roughly 1 tree per 25 m² when a site footprint is available.",
      "Includes an establishment allowance over the selected lifecycle horizon.",
    ],
  },
  {
    key: "rain garden installation",
    aliases: [
      "rain garden installation",
      "rain garden",
      "bioswale",
      "stormwater garden",
    ],
    perUnit: "per installation",
    basePrice: 18000,
    areaMode: "ceil",
    referenceAreaSqm: 50,
    scaleWithBarangayArea: true,
    lifecycleYears: 5,
    materialsShare: 0.5,
    laborShare: 0.34,
    maintenanceRate: 0.06,
    notes: [
      "A 50 m² catchment footprint is used as a planning proxy when area is available.",
    ],
  },
  {
    key: "green corridor development",
    aliases: [
      "green corridor development",
      "green corridor",
      "blue-green corridors",
      "blue green corridors",
      "corridor",
    ],
    perUnit: "per 100m corridor",
    basePrice: 65000,
    areaMode: "ceil",
    referenceAreaSqm: 300,
    scaleWithBarangayArea: true,
    lifecycleYears: 5,
    materialsShare: 0.55,
    laborShare: 0.3,
    maintenanceRate: 0.05,
    notes: [
      "Area is converted to an estimated 100 m corridor segment using a 3 m right-of-way proxy.",
    ],
  },
  {
    key: "rooftop garden installation",
    aliases: [
      "rooftop garden installation",
      "rooftop garden",
      "roof gardens",
      "roof garden",
      "building envelope green",
    ],
    perUnit: "per square meter",
    basePrice: 3500,
    areaMode: "exact",
    referenceAreaSqm: 1,
    scaleWithBarangayArea: false,
    lifecycleYears: 7,
    materialsShare: 0.58,
    laborShare: 0.32,
    maintenanceRate: 0.07,
    notes: [
      "Area is used directly only when a site footprint is explicitly provided.",
    ],
  },
  {
    key: "permeable pavement",
    aliases: ["permeable pavement", "permeable paving", "porous pavement"],
    perUnit: "per square meter",
    basePrice: 2800,
    areaMode: "exact",
    referenceAreaSqm: 1,
    scaleWithBarangayArea: false,
    lifecycleYears: 8,
    materialsShare: 0.6,
    laborShare: 0.28,
    maintenanceRate: 0.04,
    notes: [
      "Area is used directly only when the selected site footprint is explicit.",
    ],
  },
  {
    key: "green wall installation",
    aliases: ["green wall installation", "green wall", "living wall"],
    perUnit: "per square meter",
    basePrice: 9000,
    areaMode: "exact",
    referenceAreaSqm: 1,
    scaleWithBarangayArea: false,
    lifecycleYears: 7,
    materialsShare: 0.56,
    laborShare: 0.32,
    maintenanceRate: 0.08,
    notes: [
      "Area is used directly only when a facade or wall surface is explicitly provided.",
    ],
  },
  {
    key: "wetland restoration",
    aliases: ["wetland restoration", "mangrove restoration", "wetland", "mangrove"],
    perUnit: "per hectare",
    basePrice: 220000,
    areaMode: "ceil",
    referenceAreaSqm: 10000,
    scaleWithBarangayArea: true,
    lifecycleYears: 10,
    materialsShare: 0.5,
    laborShare: 0.35,
    maintenanceRate: 0.05,
    notes: [
      "Area is converted to hectares; 10,000 m² is treated as one hectare.",
    ],
  },
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectSearchTexts(input: CostEstimateInput): string[] {
  return [input.interventionType, input.solutionTitle, input.solutionDescription]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeText(value));
}

function scoreModelAgainstText(text: string, model: InterventionModel): number {
  let score = 0;
  const aliases = [model.key, ...model.aliases].map((value) => normalizeText(value));

  for (const alias of aliases) {
    if (!alias) continue;
    if (text === alias) {
      score += 1000 + alias.length;
      continue;
    }

    if (text.includes(alias)) {
      score += 250 + alias.length;
      continue;
    }

    const parts = alias.split(" ").filter(Boolean);
    if (parts.length > 1 && parts.every((part) => text.includes(part))) {
      score += 75 + parts.length * 5;
    }
  }

  return score;
}

function roundMoney(value: number): number {
  return Math.max(0, Math.round(value));
}

function clampMultiplier(value: number): number {
  return Math.min(1.2, Math.max(0.9, value));
}

function resolveModel(input: CostEstimateInput): InterventionModel {
  const texts = collectSearchTexts(input);
  let bestModel: InterventionModel | null = null;
  let bestScore = 0;

  for (const model of INTERVENTION_MODELS) {
    const score = texts.reduce(
      (runningScore, text) => runningScore + scoreModelAgainstText(text, model),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestModel = model;
    }
  }

  if (bestModel && bestScore > 0) {
    return bestModel;
  }

  const normalized = texts.join(" ");

  if (/tree|canopy/.test(normalized)) {
    return INTERVENTION_MODELS[0];
  }
  if (/garden|rain|bioswale|stormwater/.test(normalized)) {
    return INTERVENTION_MODELS[1];
  }
  if (/corridor|blue green|riparian|linear/.test(normalized)) {
    return INTERVENTION_MODELS[2];
  }
  if (/roof|rooftop|building envelope|terrace/.test(normalized)) {
    return INTERVENTION_MODELS[3];
  }
  if (/pavement|paving|porous/.test(normalized)) {
    return INTERVENTION_MODELS[4];
  }
  if (/wall|vertical|facade|living wall/.test(normalized)) {
    return INTERVENTION_MODELS[5];
  }
  if (/wetland|mangrove|marsh|estuary|coastal/.test(normalized)) {
    return INTERVENTION_MODELS[6];
  }

  return {
    key: normalized || "project",
    aliases: [],
    perUnit: "per project",
    basePrice: 10000,
    areaMode: "none",
    referenceAreaSqm: 1,
    scaleWithBarangayArea: false,
    lifecycleYears: 5,
    materialsShare: 0.55,
    laborShare: 0.3,
    maintenanceRate: 0.05,
    notes: [
      "Fallback estimate used because the intervention could not be matched to a calibrated model.",
    ],
  };
}

export function resolveCostEstimateAnchor(
  input: Pick<CostEstimateInput, "interventionType" | "solutionTitle" | "solutionDescription">,
): CostEstimateAnchor {
  const model = resolveModel({
    interventionType: input.interventionType,
    solutionTitle: input.solutionTitle,
    solutionDescription: input.solutionDescription,
  });

  return {
    key: model.key,
    basePrice: model.basePrice,
    perUnit: model.perUnit,
  };
}

function deriveScope(
  scope: CostEstimationScope | null | undefined,
  areaSqm: number | null,
): CostEstimationScope {
  if (scope) return scope;
  return areaSqm !== null ? "site" : "project";
}

function resolveQuantity(
  model: InterventionModel,
  areaSqm: number | null,
  scope: CostEstimationScope,
): number {
  if (areaSqm === null || model.areaMode === "none") {
    return 1;
  }

  const shouldScale = scope === "site" || (scope === "barangay" && model.scaleWithBarangayArea);
  if (!shouldScale) {
    return 1;
  }

  const rawQuantity = areaSqm / model.referenceAreaSqm;
  if (model.areaMode === "exact") {
    return Math.max(1, rawQuantity);
  }

  return Math.max(1, Math.ceil(rawQuantity));
}

function resolveLocationMultiplier(input: {
  greeneryIndex?: number | null;
  floodHazard?: number | null;
  stormHazard?: number | null;
  areaSqm: number | null;
  scope: CostEstimationScope;
  explicitMultiplier?: number | null;
}): number {
  if (isFiniteNumber(input.explicitMultiplier)) {
    return clampMultiplier(input.explicitMultiplier);
  }

  let multiplier = 1;

  if (isFiniteNumber(input.greeneryIndex)) {
    if (input.greeneryIndex < 0.3) {
      multiplier += 0.06;
    } else if (input.greeneryIndex < 0.5) {
      multiplier += 0.03;
    } else if (input.greeneryIndex > 0.75) {
      multiplier -= 0.02;
    }
  }

  if (isFiniteNumber(input.floodHazard)) {
    if (input.floodHazard >= 3) {
      multiplier += 0.08;
    } else if (input.floodHazard >= 2) {
      multiplier += 0.05;
    } else if (input.floodHazard >= 1) {
      multiplier += 0.02;
    }
  }

  if (isFiniteNumber(input.stormHazard)) {
    if (input.stormHazard >= 3) {
      multiplier += 0.05;
    } else if (input.stormHazard >= 2) {
      multiplier += 0.03;
    }
  }

  if (input.areaSqm !== null) {
    if (input.areaSqm < 100) {
      multiplier += 0.05;
    } else if (input.areaSqm > 20000) {
      multiplier -= 0.04;
    } else if (input.areaSqm > 5000) {
      multiplier -= 0.02;
    }
  }

  if (input.scope === "barangay") {
    multiplier += 0.01;
  }

  return clampMultiplier(multiplier);
}

export function estimateInterventionCost(
  input: CostEstimateInput,
): CostEstimateResult {
  const model = resolveModel(input);
  const areaSqm = isFiniteNumber(input.areaSqm) && input.areaSqm > 0 ? input.areaSqm : null;
  const scope = deriveScope(input.scope, areaSqm);
  const quantity = resolveQuantity(model, areaSqm, scope);
  const lifecycleYears =
    isFiniteNumber(input.lifecycleYears) && input.lifecycleYears > 0
      ? Math.round(input.lifecycleYears)
      : model.lifecycleYears;

  const capitalCost = model.basePrice * quantity;
  const annualMaintenance = capitalCost * model.maintenanceRate;
  const maintenanceSubtotal = annualMaintenance * lifecycleYears;
  const locationMultiplier = resolveLocationMultiplier({
    greeneryIndex: input.greeneryIndex,
    floodHazard: input.floodHazard,
    stormHazard: input.stormHazard,
    areaSqm,
    scope,
    explicitMultiplier: input.locationMultiplier,
  });

  const totalEstimate = roundMoney((capitalCost + maintenanceSubtotal) * locationMultiplier);
  const materials = roundMoney(capitalCost * model.materialsShare * locationMultiplier);
  const labor = roundMoney(capitalCost * model.laborShare * locationMultiplier);
  const maintenance = roundMoney(maintenanceSubtotal * locationMultiplier);
  const contingency = Math.max(
    0,
    totalEstimate - materials - labor - maintenance,
  );

  const assumptions: string[] = [...model.notes];
  assumptions.push(`Matched model: ${model.key}.`);
  assumptions.push(`Lifecycle horizon set to ${lifecycleYears} years.`);

  if (input.barangayId) {
    assumptions.push(`Barangay context: ${input.barangayId}.`);
  }

  if (areaSqm !== null) {
    if (scope === "barangay" && model.scaleWithBarangayArea) {
      assumptions.push("Barangay-level footprint used for area scaling.");
    } else if (scope === "site") {
      assumptions.push("Explicit site footprint used for area scaling.");
    } else {
      assumptions.push("Area was provided but not applied to this intervention type.");
    }
  } else {
    assumptions.push("No area input provided, so the estimate falls back to a project-scale unit cost.");
  }

  if (locationMultiplier !== 1) {
    assumptions.push("Site-condition multiplier applied from greenery and hazard signals.");
  }

  return {
    interventionType: model.key,
    basePrice: model.basePrice,
    totalEstimate,
    currencyUnit: "PHP",
    perUnit: model.perUnit,
    area: areaSqm,
    locationMultiplier,
    quantity,
    lifecycleYears,
    scope,
    breakdown: {
      materials,
      labor,
      contingency,
      maintenance,
    },
    assumptions,
  };
}
