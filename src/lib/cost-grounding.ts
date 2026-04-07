import OpenAI from "openai";

import {
  buildRAGQuery,
  retrieveRelevantChunksByQuery,
  type LocationContext,
  type RetrievedChunk,
} from "@/lib/rag";
import type {
  AssistantSource,
  CostEstimate,
  CostLineItem,
  CostMarketReference,
  TechnicalConsideration,
  TechnicalPhaseHint,
} from "@/types/green_solutions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type QuantityMode = "project" | "tree" | "installation" | "sqm" | "hectare" | "corridor100m";

type CostCatalogEntry = {
  key: string;
  aliases: string[];
  basePrice: number;
  unit: string;
  perUnit: string;
  quantityMode: QuantityMode;
  lineItemShares: {
    materials: number;
    labor: number;
    permits: number;
    maintenance: number;
    contingency: number;
  };
};

export interface GroundedCostEstimateInput {
  interventionType: string;
  solutionTitle?: string;
  solutionDescription?: string;
  rationale?: string;
  sourceStudy?: string | null;
  area?: number | null;
  barangay?: string | null;
  barangayId?: string | null;
  locationName?: string | null;
  metrics?: LocationContext;
  ragQuery?: string;
  ragChunks?: RetrievedChunk[];
}

type GroundingModelOutput = {
  estimateBasis?: string;
  confidence?: "low" | "medium" | "high";
  assumptions?: string[];
  costDrivers?: string[];
  citations?: string[];
  technicalConsiderations?: Array<{
    title?: string;
    detail?: string;
    phaseHint?: TechnicalPhaseHint;
    sourceStudy?: string | null;
  }>;
  lineItemNotes?: Array<{
    category?: CostLineItem["category"];
    rationale?: string;
    sourceStudy?: string | null;
  }>;
};

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type TavilySearchResponse = {
  results?: TavilySearchResult[];
};

const COST_CATALOG: CostCatalogEntry[] = [
  {
    key: "urban-canopy-enhancement",
    aliases: ["urban canopy enhancement", "street trees", "tree planting", "canopy"],
    basePrice: 5000,
    unit: "PHP",
    perUnit: "per tree",
    quantityMode: "tree",
    lineItemShares: { materials: 0.42, labor: 0.2, permits: 0.08, maintenance: 0.15, contingency: 0.15 },
  },
  {
    key: "rain-garden-installation",
    aliases: ["rain garden installation", "rain garden", "bioswale", "stormwater planter"],
    basePrice: 15000,
    unit: "PHP",
    perUnit: "per installation",
    quantityMode: "installation",
    lineItemShares: { materials: 0.41, labor: 0.22, permits: 0.08, maintenance: 0.12, contingency: 0.17 },
  },
  {
    key: "green-corridor-development",
    aliases: ["green corridor development", "green corridor", "blue-green corridor", "corridor"],
    basePrice: 50000,
    unit: "PHP",
    perUnit: "per 100m corridor",
    quantityMode: "corridor100m",
    lineItemShares: { materials: 0.43, labor: 0.23, permits: 0.09, maintenance: 0.1, contingency: 0.15 },
  },
  {
    key: "rooftop-garden-installation",
    aliases: ["rooftop garden installation", "roof garden", "green roof", "rooftop greening"],
    basePrice: 3000,
    unit: "PHP",
    perUnit: "per square meter",
    quantityMode: "sqm",
    lineItemShares: { materials: 0.5, labor: 0.18, permits: 0.09, maintenance: 0.08, contingency: 0.15 },
  },
  {
    key: "permeable-pavement",
    aliases: ["permeable pavement", "pervious pavement", "porous pavement"],
    basePrice: 2500,
    unit: "PHP",
    perUnit: "per square meter",
    quantityMode: "sqm",
    lineItemShares: { materials: 0.47, labor: 0.22, permits: 0.07, maintenance: 0.08, contingency: 0.16 },
  },
  {
    key: "green-wall-installation",
    aliases: ["green wall installation", "green wall", "vertical greening", "green facade"],
    basePrice: 8000,
    unit: "PHP",
    perUnit: "per square meter",
    quantityMode: "sqm",
    lineItemShares: { materials: 0.53, labor: 0.17, permits: 0.08, maintenance: 0.07, contingency: 0.15 },
  },
  {
    key: "wetland-restoration",
    aliases: ["wetland restoration", "constructed wetland", "wetland"],
    basePrice: 20000,
    unit: "PHP",
    perUnit: "per hectare",
    quantityMode: "hectare",
    lineItemShares: { materials: 0.37, labor: 0.22, permits: 0.1, maintenance: 0.12, contingency: 0.19 },
  },
  {
    key: "default-project",
    aliases: [],
    basePrice: 10000,
    unit: "PHP",
    perUnit: "per project",
    quantityMode: "project",
    lineItemShares: { materials: 0.45, labor: 0.2, permits: 0.08, maintenance: 0.1, contingency: 0.17 },
  },
];

const MARKET_LOCALITY_TERMS = [
  { label: "Mandaue City", pattern: /mandaue/i },
  { label: "Cebu", pattern: /cebu/i },
  { label: "Central Visayas", pattern: /visayas|region vii/i },
  { label: "Philippines", pattern: /philippines|philippine|ph\b/i },
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function findCatalogEntry(interventionType: string, solutionTitle?: string): CostCatalogEntry {
  const haystack = `${normalizeText(interventionType)} ${normalizeText(solutionTitle)}`;
  const matched = COST_CATALOG.find((entry) =>
    entry.aliases.some((alias) => haystack.includes(alias)),
  );
  return matched ?? COST_CATALOG[COST_CATALOG.length - 1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeCount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function resolveQuantity(mode: QuantityMode, area: number | null | undefined): number {
  const cleanArea = sanitizeCount(area);
  if (!cleanArea) {
    return 1;
  }

  // Per-intervention-type area caps to prevent unreasonable estimates
  const MAX_AREA: Record<QuantityMode, number> = {
    sqm: 10_000,
    hectare: 1_000_000, // 100 hectares
    corridor100m: 50_000, // 500 corridors
    tree: 5_000,
    installation: 100,
    project: 1,
  };
  const cappedArea = Math.min(cleanArea, MAX_AREA[mode] ?? cleanArea);

  if (mode === "sqm") {
    return cappedArea;
  }
  if (mode === "hectare") {
    return cappedArea / 10_000;
  }
  if (mode === "corridor100m") {
    return cappedArea / 100;
  }
  if (mode === "tree") {
    return cappedArea;
  }
  return 1;
}

function deriveLocationMultiplier(input: GroundedCostEstimateInput): number {
  const metrics = input.metrics ?? {};
  let multiplier = 1;

  if ((metrics.floodHazard ?? 0) >= 2) {
    multiplier += 0.06;
  }
  if ((metrics.stormHazard ?? 0) >= 2) {
    multiplier += 0.05;
  }
  if ((metrics.lst ?? 0) >= 34) {
    multiplier += 0.03;
  }
  if ((metrics.aqi ?? 0) >= 100) {
    multiplier += 0.02;
  }

  const barangayKey = normalizeText(input.barangayId ?? input.barangay);
  const barangayAdjustments: Record<string, number> = {
    barangay1: -0.1,
    barangay2: 0.1,
  };
  multiplier += barangayAdjustments[barangayKey] ?? 0;

  return Math.round(clamp(multiplier, 0.85, 1.35) * 100) / 100;
}

function roundAmount(value: number): number {
  return Math.round(value);
}

function buildLineItems(
  entry: CostCatalogEntry,
  totalEstimate: number,
): CostLineItem[] {
  const roundedTotal = roundAmount(totalEstimate);
  const permits = roundAmount(roundedTotal * entry.lineItemShares.permits);
  const materials = roundAmount(roundedTotal * entry.lineItemShares.materials);
  const labor = roundAmount(roundedTotal * entry.lineItemShares.labor);
  const maintenance = roundAmount(roundedTotal * entry.lineItemShares.maintenance);
  const contingency = roundAmount(
    roundedTotal - permits - materials - labor - maintenance,
  );

  return [
    { category: "permits", label: "Permits and coordination", estimatedCost: permits },
    { category: "materials", label: "Materials and planting inputs", estimatedCost: materials },
    { category: "labor", label: "Labor and site execution", estimatedCost: labor },
    { category: "maintenance", label: "Establishment and maintenance", estimatedCost: maintenance },
    { category: "contingency", label: "Contingency reserve", estimatedCost: contingency },
  ];
}

function formatSources(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No retrieved studies available.";
  }

  return chunks
    .slice(0, 4)
    .map((chunk, index) => {
      const content = chunk.content.slice(0, 900);
      return `[SOURCE ${index + 1}] ${chunk.studyTitle}\n${content}`;
    })
    .join("\n\n---\n\n");
}

function formatMarketReferences(references: CostMarketReference[]): string {
  if (references.length === 0) {
    return "No Tavily market references were available.";
  }

  return references
    .map((reference, index) => {
      const locality = reference.locality ? ` [${reference.locality}]` : "";
      return `[MARKET ${index + 1}] ${reference.title}${locality}\n${reference.snippet}\n${reference.url}`;
    })
    .join("\n\n---\n\n");
}

function dedupeStudies(chunks: RetrievedChunk[]): AssistantSource[] {
  const seen = new Set<string>();
  const studies: AssistantSource[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.studyTitle)) {
      continue;
    }
    seen.add(chunk.studyTitle);
    studies.push({
      studyID: chunk.studyID,
      studyTitle: chunk.studyTitle,
      similarity: chunk.similarity,
    });
  }
  return studies;
}

function detectLocality(title: string, snippet: string, url: string): string | undefined {
  const haystack = `${title} ${snippet} ${url}`;
  for (const term of MARKET_LOCALITY_TERMS) {
    if (term.pattern.test(haystack)) {
      return term.label;
    }
  }
  return undefined;
}

function scoreLocality(reference: CostMarketReference): number {
  const locality = reference.locality?.toLowerCase() ?? "";
  if (locality.includes("mandaue")) return 4;
  if (locality.includes("cebu")) return 3;
  if (locality.includes("visayas")) return 2;
  if (locality.includes("philippines")) return 1;
  return 0;
}

function marketSearchQuery(input: GroundedCostEstimateInput): string {
  const locality = input.barangay
    ? `${input.barangay}, Mandaue City Cebu Philippines`
    : input.locationName
      ? `${input.locationName}, Cebu Philippines`
      : "Mandaue City Cebu Philippines";

  return [
    input.solutionTitle ?? input.interventionType,
    input.interventionType,
    "cost price quotation supplier installation Philippines Cebu Mandaue",
    locality,
  ].join(" ");
}

async function fetchTavilyMarketReferences(
  input: GroundedCostEstimateInput,
): Promise<{ query: string; references: CostMarketReference[] } | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return null;
  }

  const query = marketSearchQuery(input);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        topic: "general",
        search_depth: "advanced",
        max_results: 6,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
    });

    if (!response.ok) {
      console.warn("Tavily cost search failed.", await response.text().catch(() => ""));
      return { query, references: [] };
    }

    const body = (await response.json()) as TavilySearchResponse;
    const references = (body.results ?? [])
      .filter((result): result is TavilySearchResult & { title: string; url: string; content: string } =>
        Boolean(result.title && result.url && result.content),
      )
      .map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content.slice(0, 320),
        score: result.score,
        locality: detectLocality(result.title, result.content, result.url),
      }))
      .sort((left, right) => {
        const localityDelta = scoreLocality(right) - scoreLocality(left);
        if (localityDelta !== 0) {
          return localityDelta;
        }
        return (right.score ?? 0) - (left.score ?? 0);
      })
      .slice(0, 4);

    return { query, references };
  } catch (error) {
    console.warn("Unable to retrieve Tavily market references.", error);
    return { query, references: [] };
  }
}

function fallbackTechnicalConsiderations(
  chunks: RetrievedChunk[],
): TechnicalConsideration[] {
  const studyTitle = chunks[0]?.studyTitle ?? null;
  return [
    {
      title: "Early permits and barangay coordination",
      detail:
        "Front-load permits, barangay approvals, and right-of-way checks before procurement so the timeline and cost plan stay aligned.",
      phaseHint: "planning",
      sourceStudy: studyTitle,
    },
    {
      title: "Maintenance is part of scope",
      detail:
        "Include establishment watering, replacement planting, and early monitoring instead of treating maintenance as optional post-work overhead.",
      phaseHint: "operations",
      sourceStudy: studyTitle,
    },
  ];
}

async function buildGroundingNarrative(
  input: GroundedCostEstimateInput,
  entry: CostCatalogEntry,
  totalEstimate: number,
  lineItems: CostLineItem[],
  ragQuery: string,
  chunks: RetrievedChunk[],
  marketReferences: CostMarketReference[],
): Promise<GroundingModelOutput | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const metrics = input.metrics ?? {};
  const prompt = `You are a cost and technical validation analyst for GreenPoint.

Important rules:
- The PHP amounts below are planning-level heuristic anchors. Do not invent claims that the studies provide direct PHP prices unless the excerpt explicitly says so.
- Use the studies to ground scope, technical requirements, phasing, maintenance, permitting, and risk-driven cost drivers.
- Keep citations limited to the study titles provided.
- Return only a JSON object.

Recommendation
Title: ${input.solutionTitle ?? input.interventionType}
Intervention type: ${input.interventionType}
Description: ${input.solutionDescription ?? "Not provided"}
Existing rationale: ${input.rationale ?? "Not provided"}
Primary cited study: ${input.sourceStudy ?? "Not provided"}

Location and metrics
Location: ${input.locationName ?? input.barangay ?? "Mandaue City"}
Barangay: ${input.barangay ?? "Unknown"}
NDVI: ${metrics.ndvi ?? "N/A"}
LST: ${metrics.lst ?? "N/A"}
Tree canopy: ${metrics.treeCanopy ?? "N/A"}
Greenery Index: ${metrics.greeneryIndex ?? "N/A"}
Flood hazard: ${metrics.floodHazard ?? "N/A"}
Storm hazard: ${metrics.stormHazard ?? "N/A"}
AQI: ${metrics.aqi ?? "N/A"}

Cost anchor
Catalog key: ${entry.key}
Base price: ${entry.basePrice} ${entry.unit} ${entry.perUnit}
Planning total estimate: ${roundAmount(totalEstimate)} PHP
Line items: ${JSON.stringify(lineItems)}
Retrieval query: ${ragQuery}

Retrieved studies
${formatSources(chunks)}

Tavily market references
${formatMarketReferences(marketReferences)}

Return JSON with keys:
- estimateBasis: string
- confidence: one of low, medium, high
- assumptions: string[]
- costDrivers: string[]
- citations: string[]
- technicalConsiderations: {title, detail, phaseHint, sourceStudy}[] where phaseHint must be exactly one of planning, legal, procurement, construction, operations
- lineItemNotes: {category, rationale, sourceStudy}[] where category must be one of materials, labor, permits, maintenance, contingency, other

Use Tavily market references only to supplement local procurement realism, supplier proximity, and regional costing context near Mandaue or Cebu. Do not present Tavily snippets as verified contractor quotations unless a snippet explicitly states a direct price.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    return JSON.parse(raw) as GroundingModelOutput;
  } catch (error) {
    console.warn("Failed to generate grounded cost narrative; using heuristic fallback.", error);
    return null;
  }
}

function costQuery(input: GroundedCostEstimateInput, metrics: LocationContext): string {
  return `${input.solutionTitle ?? input.interventionType}. ${input.solutionDescription ?? ""} ${input.rationale ?? ""} ${buildRAGQuery(metrics)} Implementation requirements, procurement constraints, maintenance burden, permitting needs, technical considerations, and cost drivers.`.trim();
}

function mergeLineItemNotes(
  lineItems: CostLineItem[],
  notes: GroundingModelOutput["lineItemNotes"],
): CostLineItem[] {
  const noteMap = new Map<CostLineItem["category"], { rationale?: string; sourceStudy?: string | null }>();
  for (const note of notes ?? []) {
    if (!note?.category) {
      continue;
    }
    noteMap.set(note.category, {
      rationale: note.rationale,
      sourceStudy: note.sourceStudy,
    });
  }

  return lineItems.map((lineItem) => ({
    ...lineItem,
    rationale: noteMap.get(lineItem.category)?.rationale ?? `${lineItem.label} is required to deliver the intervention scope at planning level.`,
    sourceStudy: noteMap.get(lineItem.category)?.sourceStudy ?? null,
  }));
}

function normalizePhaseHint(value: string | null | undefined): TechnicalPhaseHint {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "planning";
  }

  if (
    normalized.includes("operat") ||
    normalized.includes("post") ||
    normalized.includes("maint") ||
    normalized.includes("monitor") ||
    normalized.includes("establish")
  ) {
    return "operations";
  }

  if (normalized.includes("legal") || normalized.includes("permit") || normalized.includes("approval")) {
    return "legal";
  }

  if (
    normalized.includes("procure") ||
    normalized.includes("material") ||
    normalized.includes("sourcing") ||
    normalized.includes("supply")
  ) {
    return "procurement";
  }

  if (
    normalized.includes("construct") ||
    normalized.includes("install") ||
    normalized.includes("plant") ||
    normalized.includes("implement") ||
    normalized.includes("site work")
  ) {
    return "construction";
  }

  return "planning";
}

function normalizeTechnicalConsiderations(
  considerations: GroundingModelOutput["technicalConsiderations"],
  fallback: TechnicalConsideration[],
): TechnicalConsideration[] {
  const normalized = (considerations ?? [])
    .filter((item) => item?.title && item?.detail)
    .map((item) => ({
      title: item?.title ?? "Technical note",
      detail: item?.detail ?? "",
      phaseHint: normalizePhaseHint(item?.phaseHint),
      sourceStudy: item?.sourceStudy ?? null,
    }));

  return normalized.length > 0 ? normalized : fallback;
}

export async function buildGroundedCostEstimate(
  input: GroundedCostEstimateInput,
): Promise<CostEstimate> {
  const entry = findCatalogEntry(input.interventionType, input.solutionTitle);
  const metrics = input.metrics ?? {};
  const quantity = resolveQuantity(entry.quantityMode, input.area);
  const locationMultiplier = deriveLocationMultiplier(input);
  const baseTotal = entry.basePrice * quantity;
  const totalEstimate = roundAmount(
    clamp(baseTotal * locationMultiplier, 1_000, 50_000_000),
  );
  const lineItems = buildLineItems(entry, totalEstimate);

  const ragQuery =
    input.ragQuery ??
    costQuery(input, {
      areaName: input.locationName ?? input.barangay ?? undefined,
      ...metrics,
    });

  const chunks =
    input.ragChunks && input.ragChunks.length > 0
      ? input.ragChunks
      : (await retrieveRelevantChunksByQuery(ragQuery, 4)).chunks;
  const marketSearch = await fetchTavilyMarketReferences(input);
  const marketReferences = marketSearch?.references ?? [];

  const grounding = await buildGroundingNarrative(
    input,
    entry,
    totalEstimate,
    lineItems,
    ragQuery,
    chunks,
    marketReferences,
  );

  const technicalConsiderations = normalizeTechnicalConsiderations(
    grounding?.technicalConsiderations,
    fallbackTechnicalConsiderations(chunks),
  );
  const mergedLineItems = mergeLineItemNotes(lineItems, grounding?.lineItemNotes);
  const studies = dedupeStudies(chunks);

  return {
    interventionType: input.interventionType,
    basePrice: roundAmount(entry.basePrice),
    totalEstimate,
    currencyUnit: entry.unit,
    perUnit: entry.perUnit,
    area: sanitizeCount(input.area),
    locationMultiplier,
    breakdown: {
      materials: mergedLineItems.find((item) => item.category === "materials")?.estimatedCost ?? 0,
      labor: mergedLineItems.find((item) => item.category === "labor")?.estimatedCost ?? 0,
      contingency: mergedLineItems.find((item) => item.category === "contingency")?.estimatedCost ?? 0,
      permits: mergedLineItems.find((item) => item.category === "permits")?.estimatedCost ?? 0,
      maintenance: mergedLineItems.find((item) => item.category === "maintenance")?.estimatedCost ?? 0,
    },
    estimateBasis:
      grounding?.estimateBasis ??
      "Planning-level estimate anchored to GreenPoint's intervention cost library, then adjusted by site risk and scope assumptions. Retrieved studies ground technical scope, maintenance, and permitting needs rather than direct PHP market prices.",
    confidence: grounding?.confidence ?? "medium",
    assumptions:
      grounding?.assumptions?.filter(Boolean) ?? [
        "Estimate is a planning-level approximation, not a contractor quotation.",
        "Permitting, procurement, and maintenance are included as explicit cost drivers.",
        "Retrieved studies were used to ground technical scope and implementation assumptions.",
      ],
    costDrivers:
      grounding?.costDrivers?.filter(Boolean) ?? [
        "Site risk and permitting complexity in Mandaue City can shift schedule and overhead.",
        "Maintenance and establishment requirements materially affect total project cost.",
      ],
    technicalConsiderations,
    citations:
      grounding?.citations?.filter(Boolean) ?? studies.map((study) => study.studyTitle),
    lineItems: mergedLineItems,
    marketReferences,
    sourceContext: {
      query: ragQuery,
      studies,
      marketSearchQuery: marketSearch?.query,
    },
  };
}