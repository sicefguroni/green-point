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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationContext {
  areaName?: string;
  ndvi?: number;
  lst?: number;
  treeCanopy?: number;
  greeneryIndex?: number;
  greeneryLevel?: string;
  floodHazard?: number;
  stormHazard?: number;
  aqi?: number;
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

export function buildRAGQuery(context: LocationContext): string {
  const parts: string[] = [];
  if (context.areaName) parts.push(`Greening solutions for ${context.areaName} in the Philippines.`);
  if (context.ndvi !== undefined) parts.push(`NDVI value: ${context.ndvi.toFixed(2)}.`);
  if (context.lst !== undefined) parts.push(`Surface temperature: ${context.lst.toFixed(1)}°C.`);
  if (context.floodHazard && context.floodHazard >= 2) parts.push("High flood risk area.");
  parts.push("What are effective urban greening interventions grounded in scientific studies?");
  return parts.join(" ");
}

/**
 * Generate a vector embedding for the query using OpenAI text-embedding-3-small.
 */
async function embedQuery(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });
  return res.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

export async function retrieveRelevantChunks(context: LocationContext, topK: number = 6): Promise<RAGResult> {
  const query = buildRAGQuery(context);
  const queryVector = await embedQuery(query);

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("supabase.com") ? { rejectUnauthorized: false } : false,
  });

  let chunks: RetrievedChunk[] = [];
  try {
    const vectorString = `[${queryVector.join(",")}]`;
    const result = await pool.query(`
      SELECT 
        sc.id, sc."studyID", sc.content, rs.title AS "studyTitle",
        1 - (sc.embedding <=> $1::vector) AS similarity
      FROM "StudyChunk" sc
      JOIN "ResearchStudy" rs ON rs.id = sc."studyID"
      WHERE sc.embedding IS NOT NULL
      ORDER BY sc.embedding <=> $1::vector
      LIMIT $2
    `, [vectorString, topK]);

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

// ---------------------------------------------------------------------------
// Prompt Construction (OpenAI Style)
// ---------------------------------------------------------------------------

export function buildGenerationPrompt(context: LocationContext, retrievedChunks: RetrievedChunk[]) {
  const contextBlock = retrievedChunks
    .map((c, i) => `[SOURCE ${i + 1}: "${c.studyTitle}"]\n${c.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are an expert urban greening consultant for Philippine cities.
Grounded strictly in the research excerpts provided, generate 3-5 prioritise greening recommendations.
Format: Return ONLY a raw JSON array. Cite specific studies in the "rationale" and "sourceStudy" fields.`;

  const userPrompt = `## LOCATION CONTEXT
Area: ${context.areaName ?? "Unknown"} (NDVI: ${context.ndvi}, LST: ${context.lst}°C, Flood Hazard: ${context.floodHazard}/3)

## RESEARCH EVIDENCE
${contextBlock || "Use best practices for tropical Philippine urban greening."}

Return a JSON array of recommendation objects with fields: 
"name", "interventionType", "description", "rationale" (citing studies), "sourceStudy", "priority", "estimatedImpact", "efficiency", "relevancy", "cost", "costUnit" (PHP).`;

  return { systemPrompt, userPrompt };
}

/**
 * NEW: Generate cited recommendations via GPT-4o-mini (bypasses Gemini quota).
 */
export async function generateOpenAIRecommendation(context: LocationContext, chunks: RetrievedChunk[]) {
  const { systemPrompt, userPrompt } = buildGenerationPrompt(context, chunks);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" }
  });

  return completion.choices[0].message.content;
}
