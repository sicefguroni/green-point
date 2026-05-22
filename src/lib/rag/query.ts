/**
 * RAG Query module
 * Query building, embedding generation, and retrieval from the study database.
 */

import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { analyzeSiteSignals, isFiniteNumber } from "@/lib/site-analysis";
import type { VisionContext } from "@/lib/vision/context";

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
  areaHectares?: number | null;
  visionContext?: VisionContext | null;
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
// Query builder
// ---------------------------------------------------------------------------

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
  if (context.visionContext && context.visionContext.confidence >= 0.35) {
    const vision = context.visionContext;
    parts.push(
      `Photo-derived context: ground space ${vision.groundOpenSpaceLevel.toLowerCase()}, building density ${vision.buildingDensityLevel.toLowerCase()}, roof potential ${vision.roofGreeningPotential.toLowerCase()}, vertical potential ${vision.verticalGreeningPotential.toLowerCase()}, soil visibility ${vision.soilVisibility.toLowerCase()}, permeability hint ${vision.permeabilityHint.toLowerCase()}.`,
    );
  }

  const {
    substantialExistingGreen,
    likelyDenseLimitedGround,
    highTaggedTreeDensity,
    taggedTreeCount,
  } = analyzeSiteSignals(context);
  if (highTaggedTreeDensity) {
    parts.push(
      `City tree inventory records ${taggedTreeCount} tagged trees in this area confirming existing tree cover; lead with creation options that add greenery (understory, shrubs, vertical greening, pocket parks, targeted infill) and treat stewardship/maintenance as supporting only.`,
    );
  } else if (substantialExistingGreen) {
    parts.push(
      "Mature canopy or high greenery index; lead with creation options that add greenery (targeted infill, understory, vertical greening, pocket parks) and use stewardship only as a supporting recommendation.",
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

// ---------------------------------------------------------------------------
// Embedding & Retrieval
// ---------------------------------------------------------------------------

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

export async function retrieveRelevantChunksByQuery(
  query: string,
  topK: number = 6,
): Promise<RAGResult> {
  const queryVector = await embedQuery(query);

  let chunks: RetrievedChunk[] = [];
  try {
    const vectorString = `[${queryVector.join(",")}]`;
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        studyID: string;
        content: string;
        studyTitle: string;
        similarity: number | string;
      }[]
    >(
      `SELECT
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
      LIMIT $2`,
      vectorString,
      topK,
      DEFAULT_MIN_SIMILARITY,
    );

    chunks = rows.map((row) => ({
      id: row.id,
      studyID: row.studyID,
      studyTitle: row.studyTitle,
      content: row.content,
      similarity: Number(row.similarity),
    }));
  } catch (err) {
    console.error("RAG chunk retrieval failed:", err);
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
