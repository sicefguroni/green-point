import { z } from "zod";
import { isValidResource, type DataResourceName } from "./types";

export class InvalidIncludeError extends Error {
  readonly apiCode = "INVALID_INCLUDE" as const;
  constructor(message: string) {
    super(message);
    this.name = "InvalidIncludeError";
  }
}

/** Normalized tokens accepted for `bundle=map-env&include=` (matches service aliases). */
const MAP_ENV_INCLUDE_ALLOWED = new Set([
  "lst",
  "ndvi",
  "greeneryindex",
  "gi",
  "greenery",
  "aqi",
  "lsttile",
  "lst_tile",
  "ndvitile",
  "ndvi_tile",
  "canopytile",
  "canopy_tile",
  "gitile",
  "gi_tile",
]);

const resourceNameSchema = z
  .string()
  .refine((r): r is DataResourceName => isValidResource(r), "Unknown resource");

const latLngSchema = z.object({
  lat: z.string().min(1, "lat is required"),
  lng: z.string().min(1, "lng is required"),
});

const includeStringSchema = z.string().max(2048).optional().nullable();

export type ParsedDataApiQuery =
  | { mode: "bundle"; include: string | null }
  | {
      mode: "resource";
      resource: DataResourceName;
      lat: string | null;
      lng: string | null;
      cityId: string | null;
      id: string | null;
    };

export function parseDataApiQuery(searchParams: URLSearchParams):
  | { ok: true; query: ParsedDataApiQuery }
  | { ok: false; error: string; code: string } {
  const bundle = searchParams.get("bundle");
  const resource = searchParams.get("resource");

  if (bundle && resource) {
    return {
      ok: false,
      error: "Specify only one of bundle or resource",
      code: "AMBIGUOUS",
    };
  }

  if (bundle === "map-env") {
    const inc = includeStringSchema.safeParse(searchParams.get("include"));
    if (!inc.success) {
      return {
        ok: false,
        error: inc.error.issues[0]?.message ?? "Invalid include",
        code: "BAD_PARAMS",
      };
    }
    return { ok: true, query: { mode: "bundle", include: inc.data ?? null } };
  }

  if (bundle) {
    return {
      ok: false,
      error: `Unknown bundle: ${bundle}`,
      code: "UNKNOWN_BUNDLE",
    };
  }

  if (!resource) {
    return {
      ok: false,
      error: "Missing required query: resource=<name> or bundle=map-env",
      code: "MISSING_PARAMS",
    };
  }

  const resParsed = resourceNameSchema.safeParse(resource);
  if (!resParsed.success) {
    return {
      ok: false,
      error: `Unknown resource: ${resource}`,
      code: "UNKNOWN_RESOURCE",
    };
  }

  const r = resParsed.data;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (r === "point" || r === "waqi") {
    const coords = latLngSchema.safeParse({ lat, lng });
    if (!coords.success) {
      return {
        ok: false,
        error: coords.error.issues[0]?.message ?? "Invalid coordinates",
        code: "BAD_PARAMS",
      };
    }
  }

  return {
    ok: true,
    query: {
      mode: "resource",
      resource: r,
      lat,
      lng,
      cityId: searchParams.get("cityId"),
      id: searchParams.get("id"),
    },
  };
}

/**
 * @throws Error with message prefixed for route mapping when tokens are invalid
 */
export function assertValidMapEnvInclude(include: string | null | undefined): void {
  if (include == null || !include.trim()) return;
  const tokens = include
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const t of tokens) {
    if (!MAP_ENV_INCLUDE_ALLOWED.has(t)) {
      throw new InvalidIncludeError(`Unknown include token: ${t}`);
    }
  }
}
