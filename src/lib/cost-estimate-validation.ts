import type { LocationContext } from "@/lib/rag";
import type { CostEstimate } from "@/types/green_solutions";

export type AdditionalServiceInput = {
  label?: string;
  cost?: number;
};

export type GroundedCostEstimateRequestPayload = {
  interventionType: string;
  solutionTitle?: string;
  solutionDescription?: string;
  rationale?: string;
  sourceStudy?: string | null;
  area?: number;
  barangayId?: string;
  location?: {
    name?: string;
    barangay?: string;
  };
  metrics?: LocationContext;
  customization?: {
    additionalServices?: AdditionalServiceInput[];
  };
};

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return sanitizeString(value);
}

function sanitizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function sanitizeNumericString(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sanitizeMetrics(value: unknown): LocationContext | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return {
    ndvi: sanitizeNumber(record.ndvi),
    lst: sanitizeNumber(record.lst),
    treeCanopy: sanitizeNumber(record.treeCanopy),
    greeneryIndex: sanitizeNumber(record.greeneryIndex),
    greeneryLevel: sanitizeNullableString(record.greeneryLevel),
    floodHazard: sanitizeNumber(record.floodHazard),
    stormHazard: sanitizeNumber(record.stormHazard),
    aqi: sanitizeNumber(record.aqi),
  };
}

function sanitizeLocation(value: unknown):
  | GroundedCostEstimateRequestPayload["location"]
  | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const location = {
    name: sanitizeString(record.name),
    barangay: sanitizeString(record.barangay),
  };

  return location.name || location.barangay ? location : undefined;
}

function sanitizeAdditionalServices(
  value: unknown,
): AdditionalServiceInput[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const services = value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const cost = sanitizeNumber(record.cost);
      if (cost === undefined) {
        return null;
      }

      return {
        label: sanitizeString(record.label),
        cost,
      } satisfies AdditionalServiceInput;
    })
    .filter((entry): entry is AdditionalServiceInput => entry !== null);

  return services.length > 0 ? services : undefined;
}

export function parseGroundedCostEstimateBody(
  body: unknown,
): ParseResult<GroundedCostEstimateRequestPayload> {
  const record = asRecord(body);
  if (!record) {
    return { success: false, error: "Request body must be an object." };
  }

  const interventionType = sanitizeString(record.interventionType);
  if (!interventionType) {
    return { success: false, error: "interventionType is required" };
  }

  const customization = asRecord(record.customization);

  return {
    success: true,
    data: {
      interventionType,
      solutionTitle: sanitizeString(record.solutionTitle),
      solutionDescription: sanitizeString(record.solutionDescription),
      rationale: sanitizeString(record.rationale),
      sourceStudy: sanitizeNullableString(record.sourceStudy),
      area: sanitizeNumber(record.area),
      barangayId: sanitizeString(record.barangayId),
      location: sanitizeLocation(record.location),
      metrics: sanitizeMetrics(record.metrics),
      customization: {
        additionalServices: sanitizeAdditionalServices(
          customization?.additionalServices,
        ),
      },
    },
  };
}

export function parseGroundedCostEstimateQuery(
  params: URLSearchParams,
): ParseResult<GroundedCostEstimateRequestPayload> {
  const interventionType = sanitizeString(params.get("interventionType"));
  if (!interventionType) {
    return { success: false, error: "interventionType is required" };
  }

  const location = {
    name: sanitizeString(params.get("locationName")),
    barangay: sanitizeString(params.get("barangay")),
  };

  return {
    success: true,
    data: {
      interventionType,
      solutionTitle:
        sanitizeString(params.get("solutionTitle")) ?? interventionType,
      solutionDescription: sanitizeString(params.get("solutionDescription")),
      rationale: sanitizeString(params.get("rationale")),
      sourceStudy: sanitizeNullableString(params.get("sourceStudy")),
      area: sanitizeNumericString(params.get("area")),
      barangayId: sanitizeString(params.get("barangayId")),
      location: location.name || location.barangay ? location : undefined,
      metrics: sanitizeMetrics({
        ndvi: sanitizeNumericString(params.get("ndvi")),
        lst: sanitizeNumericString(params.get("lst")),
        treeCanopy: sanitizeNumericString(params.get("treeCanopy")),
        greeneryIndex: sanitizeNumericString(params.get("greeneryIndex")),
        greeneryLevel: sanitizeString(params.get("greeneryLevel")),
        floodHazard: sanitizeNumericString(params.get("floodHazard")),
        stormHazard: sanitizeNumericString(params.get("stormHazard")),
        aqi: sanitizeNumericString(params.get("aqi")),
      }),
    },
  };
}

function readFiniteNumber(
  value: unknown,
  label: string,
): { value?: number; error?: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { error: `${label} must be a finite number.` };
  }
  if (value < 0) {
    return { error: `${label} cannot be negative.` };
  }
  return { value };
}

export function getCostEstimateCoherenceError(estimate: unknown): string | null {
  const record = asRecord(estimate);
  if (!record) {
    return "Cost estimate must be an object.";
  }

  if (!sanitizeString(record.interventionType)) {
    return "Cost estimate interventionType is required.";
  }
  if (!sanitizeString(record.currencyUnit)) {
    return "Cost estimate currencyUnit is required.";
  }
  if (!sanitizeString(record.perUnit)) {
    return "Cost estimate perUnit is required.";
  }

  const basePrice = readFiniteNumber(record.basePrice, "basePrice");
  if (basePrice.error) {
    return basePrice.error;
  }
  const totalEstimate = readFiniteNumber(record.totalEstimate, "totalEstimate");
  if (totalEstimate.error) {
    return totalEstimate.error;
  }
  const locationMultiplier = readFiniteNumber(
    record.locationMultiplier,
    "locationMultiplier",
  );
  if (locationMultiplier.error) {
    return locationMultiplier.error;
  }

  const breakdown = asRecord(record.breakdown);
  if (!breakdown) {
    return "Cost estimate breakdown is required.";
  }

  const materials = readFiniteNumber(breakdown.materials, "breakdown.materials");
  if (materials.error) {
    return materials.error;
  }
  const labor = readFiniteNumber(breakdown.labor, "breakdown.labor");
  if (labor.error) {
    return labor.error;
  }
  const contingency = readFiniteNumber(
    breakdown.contingency,
    "breakdown.contingency",
  );
  if (contingency.error) {
    return contingency.error;
  }

  const optionalBreakdownKeys = ["permits", "maintenance", "other"] as const;
  const optionalBreakdownTotal = optionalBreakdownKeys.reduce((sum, key) => {
    const value = breakdown[key];
    if (value === undefined || value === null) {
      return sum;
    }
    const parsed = readFiniteNumber(value, `breakdown.${key}`);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return sum + (parsed.value ?? 0);
  }, 0);

  const breakdownTotal =
    (materials.value ?? 0) +
    (labor.value ?? 0) +
    (contingency.value ?? 0) +
    optionalBreakdownTotal;
  const allowedVariance = Math.max(1, (totalEstimate.value ?? 0) * 0.02);
  if (Math.abs(breakdownTotal - (totalEstimate.value ?? 0)) > allowedVariance) {
    return "Cost estimate breakdown does not align with totalEstimate.";
  }

  return null;
}

export function isCostEstimateCoherent(estimate: unknown): estimate is CostEstimate {
  return getCostEstimateCoherenceError(estimate) === null;
}