/**
 * RAG Engine for Green-Point
 * Retrieves semantically relevant research chunks for a given context query,
 * then provides them as grounded context for generative AI recommendations.
 *
 * Embeddings: OpenAI text-embedding-3-small (1536 dims)
 * Generation: OpenAI gpt-4o-mini (high quota, fast, cited)
 */

import { Pool } from "pg";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEFAULT_MIN_SIMILARITY = (() => {
  const parsed = Number(process.env.RAG_SIMILARITY_FLOOR ?? "0.2");
  return Number.isFinite(parsed) ? parsed : 0.2;
})();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationContext {
  areaName?: string;
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
}

export interface RetrievedChunk {
  id: string;
  studyID: string;
  studyTitle: string;
  content: string;
  similarity: number;
}

export interface RAGResult {
  chunks: RetrievedChunk[];
  query: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatTreeCanopyForPrompt(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "N/A";
  const pct = value >= 0 && value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

function formatOptionalFixed(
  value: number | null | undefined,
  digits: number,
): string {
  if (!isFiniteNumber(value)) return "N/A";
  return value.toFixed(digits);
}

/** Tree canopy as 0–1 fraction (handles 0–100% from some sources). */
function canopyFraction01(
  value: number | null | undefined,
): number | undefined {
  if (!isFiniteNumber(value)) return undefined;
  return value > 1 ? value / 100 : value;
}

type SiteSignals = {
  substantialExistingGreen: boolean;
  likelyDenseLimitedGround: boolean;
  /** True when ground-truth inventory confirms meaningful tree presence */
  highTaggedTreeDensity: boolean;
  taggedTreeCount: number;
};

function analyzeSiteSignals(context: LocationContext): SiteSignals {
  const canopyFrac = canopyFraction01(context.treeCanopy);
  const gi = isFiniteNumber(context.greeneryIndex)
    ? context.greeneryIndex
    : undefined;
  const ndvi = isFiniteNumber(context.ndvi) ? context.ndvi : undefined;
  const lst = isFiniteNumber(context.lst) ? context.lst : undefined;
  const level = (context.greeneryLevel ?? "").trim();
  const taggedTreeCount = isFiniteNumber(context.taggedTreeCount as unknown)
    ? (context.taggedTreeCount as number)
    : 0;
  const inventoryCanopy = canopyFraction01(context.inventoryCanopyFraction);

  const substantialExistingGreen =
    (canopyFrac !== undefined && canopyFrac >= 0.45) ||
    (gi !== undefined && gi >= 0.6) ||
    /^(High|Very High)$/i.test(level);

  /** Stricter than before: heat-island + low green signals together (avoid over-flagging). */
  const likelyDenseLimitedGround =
    !substantialExistingGreen &&
    lst !== undefined &&
    lst >= 33.5 &&
    ((canopyFrac !== undefined && canopyFrac < 0.22) ||
      (gi !== undefined && gi < 0.38) ||
      (ndvi !== undefined && ndvi < 0.22));

  const highTaggedTreeDensity =
    (inventoryCanopy !== undefined && inventoryCanopy >= 0.3) ||
    (taggedTreeCount >= 10 && canopyFrac !== undefined && canopyFrac >= 0.25);

  return {
    substantialExistingGreen,
    likelyDenseLimitedGround,
    highTaggedTreeDensity,
    taggedTreeCount,
  };
}

export function buildSiteUrbanFormGuidance(context: LocationContext): string {
  const {
    substantialExistingGreen,
    likelyDenseLimitedGround,
    highTaggedTreeDensity,
    taggedTreeCount,
  } = analyzeSiteSignals(context);
  const parts: string[] = [];

  if (highTaggedTreeDensity) {
    const inventoryPct = isFiniteNumber(
      context.inventoryCanopyFraction as unknown,
    )
      ? ` (inventory canopy ≈ ${((context.inventoryCanopyFraction as number) * 100).toFixed(1)}%)`
      : "";
    parts.push(
      `**Ground-truth tree inventory:** ${taggedTreeCount} tagged tree(s) are recorded in this area${inventoryPct}—confirming meaningful existing tree cover from the city's official inventory. **Significantly de-emphasize** large-scale new street-tree planting campaigns as the primary recommendation. Instead prioritize: **understory and shrub planting**, **green roofs / vertical greening**, **tree stewardship and maintenance**, **shade-tolerant ground cover**, and **community garden or pocket park** interventions. Targeted infill tree planting is still valid where inventory shows gaps in species diversity, shade equity, or corridor continuity.`,
    );
  } else if (substantialExistingGreen) {
    parts.push(
      "**Existing canopy / greenery:** Canopy or Greenery Index is relatively high—**avoid over-weighting** generic large-scale new street-tree campaigns as the only top options. Still allow **targeted tree planting** where research supports clear gaps (shade deficits, corridor continuity, species diversity, equity of access, or vacant strips). Balance with stewardship, infill, and **some** roof/vertical/courtyard options where they add value.",
    );
  }

  if (likelyDenseLimitedGround) {
    parts.push(
      "**Heat-stressed, built-up context (heuristic):** Metrics suggest a **tighter** ground footprint—**lean somewhat** toward roof gardens, green roofs, vertical/green walls, facade/balcony greening, and pocket/courtyard interventions, **without excluding** **narrow linear planting**, parklets, or **street trees** where a verifiable verge, median, or small parcel exists. Mention space trade-offs briefly when relevant. Slightly favor feasibility for modular/envelope options only when ground expansion is genuinely difficult—not as a blanket rule.",
    );
  }

  parts.push(
    "**General:** Offer a **balanced mix** of ground-based (including trees where appropriate) and building-envelope options; let the evidence and metrics decide weights.",
  );

  return parts.join("\n\n");
}

export function buildRAGQuery(context: LocationContext): string {
  const parts: string[] = [];
  if (context.areaName) {
    parts.push(
      `Greening solutions for ${context.areaName} in the Philippines.`,
    );
  }
  if (isFiniteNumber(context.ndvi)) {
    parts.push(`NDVI vegetation greenness: ${context.ndvi.toFixed(2)}.`);
  }
  if (isFiniteNumber(context.lst)) {
    parts.push(
      `Land surface temperature: ${context.lst.toFixed(1)} degrees Celsius.`,
    );
  }
  if (isFiniteNumber(context.treeCanopy)) {
    const pct =
      context.treeCanopy >= 0 && context.treeCanopy <= 1
        ? context.treeCanopy * 100
        : context.treeCanopy;
    parts.push(`Tree canopy cover about ${pct.toFixed(1)} percent.`);
  }
  if (isFiniteNumber(context.greeneryIndex)) {
    parts.push(
      `Composite Greenery Index ${context.greeneryIndex.toFixed(3)} (${context.greeneryLevel ?? "level unknown"}).`,
    );
  } else if (context.greeneryLevel) {
    parts.push(`Greenery level: ${context.greeneryLevel}.`);
  }
  if (isFiniteNumber(context.floodHazard)) {
    parts.push(`Flood hazard ${context.floodHazard} out of 3.`);
    if (context.floodHazard >= 2) {
      parts.push(
        "High flood risk; stormwater and flood-resilient green infrastructure are relevant.",
      );
    }
  }
  if (isFiniteNumber(context.stormHazard)) {
    parts.push(`Storm or surge hazard ${context.stormHazard} out of 3.`);
    if (context.stormHazard >= 2) {
      parts.push(
        "High storm exposure; wind-resistant and drainage-aware greening may apply.",
      );
    }
  }
  if (isFiniteNumber(context.aqi)) {
    parts.push(
      `Air quality index AQI approximately ${context.aqi.toFixed(0)}.`,
    );
    if (context.aqi > 100) {
      parts.push(
        "Elevated air pollution; vegetation for pollutant capture and health co-benefits is relevant.",
      );
    }
  }

  const {
    substantialExistingGreen,
    likelyDenseLimitedGround,
    highTaggedTreeDensity,
    taggedTreeCount,
  } = analyzeSiteSignals(context);
  if (highTaggedTreeDensity) {
    parts.push(
      `City tree inventory records ${taggedTreeCount} tagged trees in this area confirming existing tree cover; focus on understory, shrubs, vertical greening, stewardship, and non-tree urban greening interventions.`,
    );
  } else if (substantialExistingGreen) {
    parts.push(
      "Mature canopy or high greenery index; balance new planting with stewardship and infill where studies support gaps.",
    );
  } else if (likelyDenseLimitedGround) {
    parts.push(
      "Urban heat island pattern; include vertical and roof greening alongside targeted street or pocket tree planting where feasible.",
    );
  }

  parts.push(
    "What are effective urban greening interventions grounded in scientific studies?",
  );
  return parts.join(" ");
}

export function formatLocationContextBlock(context: LocationContext): string {
  const lines: string[] = [];
  lines.push(`Area: ${context.areaName ?? "Unknown"}`);
  lines.push(`- NDVI (greenness): ${formatOptionalFixed(context.ndvi, 2)}`);
  lines.push(
    `- LST (surface temperature): ${formatOptionalFixed(context.lst, 1)}°C`,
  );
  lines.push(
    `- Tree canopy (blended): ${formatTreeCanopyForPrompt(context.treeCanopy)}`,
  );
  lines.push(
    `- Greenery Index (composite): ${formatOptionalFixed(context.greeneryIndex, 3)}`,
  );
  lines.push(
    `- Greenery level (band): ${context.greeneryLevel != null && context.greeneryLevel !== "" ? context.greeneryLevel : "N/A"}`,
  );
  lines.push(
    `- Flood hazard: ${isFiniteNumber(context.floodHazard) ? context.floodHazard : "N/A"}/3`,
  );
  lines.push(
    `- Storm / surge hazard: ${isFiniteNumber(context.stormHazard) ? context.stormHazard : "N/A"}/3`,
  );
  lines.push(`- Air quality (AQI): ${formatOptionalFixed(context.aqi, 0)}`);
  // Tagged tree inventory
  const treeCount = isFiniteNumber(context.taggedTreeCount as unknown)
    ? (context.taggedTreeCount as number)
    : null;
  const invCanopy = isFiniteNumber(context.inventoryCanopyFraction as unknown)
    ? (context.inventoryCanopyFraction as number)
    : null;
  lines.push(
    `- Tagged tree inventory count: ${
      treeCount !== null ? treeCount : "N/A"
    } tree(s) (ground-truth city inventory)`,
  );
  lines.push(
    `- Inventory-only canopy fraction: ${
      invCanopy !== null ? `${(invCanopy * 100).toFixed(1)}%` : "N/A"
    } (from tagged tree crown areas only)`,
  );
  return lines.join("\n");
}

/**
 * Generate a vector embedding for the query using OpenAI text-embedding-3-small.
 */
async function embedQuery(text: string): Promise<number[]> {
  try {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    return res.data[0].embedding;
  } catch (error) {
    console.error("RAG embedding generation failed:", error);
    throw new Error(
      `Failed to generate embedding for RAG query. ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

export async function retrieveRelevantChunksByQuery(
  query: string,
  topK: number = 6,
): Promise<RAGResult> {
  const queryVector = await embedQuery(query);

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : false,
  });

  let chunks: RetrievedChunk[] = [];
  try {
    const vectorString = `[${queryVector.join(",")}]`;
    const result = await pool.query(
      `
      SELECT
        ranked.id,
        ranked."studyID",
        ranked.content,
        ranked."studyTitle",
        ranked.similarity
      FROM (
        SELECT
          sc.id,
          sc."studyID",
          sc.content,
          rs.title AS "studyTitle",
          1 - (sc.embedding <=> $1::vector) AS similarity
        FROM "StudyChunk" sc
        JOIN "ResearchStudy" rs ON rs.id = sc."studyID"
        WHERE sc.embedding IS NOT NULL
      ) ranked
      WHERE ranked.similarity >= $3
      ORDER BY ranked.similarity DESC
      LIMIT $2
    `,
      [vectorString, topK, DEFAULT_MIN_SIMILARITY],
    );

    chunks = result.rows.map((row) => ({
      id: row.id,
      studyID: row.studyID,
      studyTitle: row.studyTitle,
      content: row.content,
      similarity: parseFloat(row.similarity),
    }));
  } finally {
    await pool.end();
  }

  return { chunks, query };
}

export async function retrieveRelevantChunks(
  context: LocationContext,
  topK: number = 6,
): Promise<RAGResult> {
  const query = buildRAGQuery(context);
  return retrieveRelevantChunksByQuery(query, topK);
}

// ---------------------------------------------------------------------------
// Prompt Construction (OpenAI Style)
// ---------------------------------------------------------------------------

export function buildGenerationPrompt(
  context: LocationContext,
  retrievedChunks: RetrievedChunk[],
) {
  const contextBlock = retrievedChunks
    .map((c, i) => `[SOURCE ${i + 1}: "${c.studyTitle}"]\n${c.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are an expert urban greening consultant for Philippine cities.
Grounded strictly in the research excerpts provided, generate 3-5 prioritized recommendations.

Adapt intervention types to **site context** (see SITE FORM & SPACE below)—these are **soft** biases, not hard bans:
- Where **tagged tree inventory confirms meaningful existing trees**, **strongly de-emphasize** broad new tree-planting as the primary recommendation; prioritize understory plants, shrubs, vertical greening, stewardship, and maintenance. Allow targeted infill tree planting only for documented gaps.
- Where **canopy / Greenery Index are already high** (but low inventory count), **slightly de-emphasize** only **broad** new tree-planting campaigns; keep **targeted** trees (gaps, corridors, shade equity) when the evidence fits. Mix in stewardship and other options as appropriate.
- Where metrics suggest **tight ground** (heat stress + low green), **lean** toward roof/vertical/envelope and pocket greening, but **still include** street or verge trees, parklets, or small groves when justified.
- When helpful, **briefly name** the constraint (e.g. high tagged-tree count vs tight ROW)—not every recommendation must repeat it.

For each, provide:
- "name": Concise title.
- "interventionType": Type of solution.
- "summary": A very brief (max 10-15 words) description of what this is, suitable for a small card.
- "description": A concise (1-3 sentences) detailed description of the intervention.
- "justification": A concise 1-2-sentence justification for WHY this is recommended for THIS specific location. Explicitly reference relevant site metrics by name (e.g. NDVI, LST, tagged tree count).
- "recommendedSpecies": A string listing 1-4 specific plant or tree species suitable for this intervention in a Philippine urban context (e.g., "Narraw, Molave, Knight's Bush"), ideally based on the research provided or local suitability. It would be nice if the local name  
- "rationale": Scientific rationale citing specific studies.
- "sourceStudy": Title of the primary study matching a source.
- "priority": "high", "medium", or "low".
- "efficiency": number (0-100) representing site-specific effectiveness.
- "equity": number (0-1) social benefit level.
- "cost": number (0-1) normalized cost (0=cheap, 1=expensive).
- "impact": number (0-1) environmental impact level.
- "relevancy": number (0-1) how well the intervention matches this site's hazards and metrics.
- "feasibility": number (0-1) practical feasibility in a typical Philippine urban barangay: land tenure, maintenance burden, institutional capacity, supply chain, and time-to-implement (1 = very feasible).

Format: Return ONLY a JSON object with a "recommendations" key containing the array.`;

  const userPrompt = `## LOCATION CONTEXT
${formatLocationContextBlock(context)}

## SITE FORM & SPACE (use for reasoning and prioritization)
${buildSiteUrbanFormGuidance(context)}

## RESEARCH EVIDENCE
${contextBlock || "Use best practices for Philippine urban greening."}

Tailor recommendations using the metrics above, SITE FORM & SPACE, and the evidence. Guidelines (apply when metrics fit; **balance** SITE FORM with evidence):
- **Tagged tree count is ground-truth**: If the inventory shows significant existing trees, shift emphasis away from new large-scale tree planting and toward understory planting, shrubs, vertical greening, tree care, and other greening types.
- High LST or heat stress: prioritize **cooling** (shade, evapotranspiration). Combine **trees** (including **narrow strips / suitable ROW**), **green roofs**, **cool corridors**, and **vertical greening** as appropriate; if canopy or tree inventory is already high, favor **targeted** planting over city-wide generic campaigns.
- Low NDVI + low canopy + low tagged tree count: vegetation establishment and canopy building remain valid; in dense areas, pair **some** ground trees with roof/vertical options.
- Heat-island + tight ground (see SITE FORM): weight **roof, vertical, envelope, pocket** a bit more, but **do not drop** tree planting if the research supports a feasible verge, median, or pocket site.
- High flood hazard: stormwater retention, bioswales, riparian buffers, permeable surfaces where appropriate.
- High storm hazard: wind-resilient species, drainage-aware siting, coastal or surge-aware planting where relevant.
- High AQI: pollutant capture, buffer planting, health-related co-benefits.
Score "feasibility" with a **light touch** on space: lower only when an option is clearly impractical; **street and pocket tree planting** can still score well when maintenance and tenure are realistic.
Cite sources accurately.`;

  return { systemPrompt, userPrompt };
}

/**
 * NEW: Generate cited recommendations via GPT-4o-mini
 */
export async function generateOpenAIRecommendation(
  context: LocationContext,
  chunks: RetrievedChunk[],
) {
  const { systemPrompt, userPrompt } = buildGenerationPrompt(context, chunks);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  return completion.choices[0].message.content;
}
