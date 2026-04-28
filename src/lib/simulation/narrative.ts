/**
 * Narrative + RAG layer for the simulation engine.
 *
 * The deterministic engine produces *all the numbers*. This module asks an
 * LLM, grounded in retrieved research excerpts, to explain WHY the strategy is
 * effective for this barangay, what its shortcomings are, what drives the
 * outcome (in plain language), and which study supports each metric. Numbers
 * are read-only inputs to the prompt — the LLM is forbidden from inventing
 * its own coefficients.
 */
import OpenAI from "openai";
import {
  buildRAGQuery,
  retrieveRelevantChunksByQuery,
  type LocationContext,
  type RetrievedChunk,
} from "@/lib/rag";
import type {
  SimulationBaselineData,
  SimulationEstimates,
  SimulationInputsState,
  SimulationNarrative,
} from "@/components/ui/simulation/simulation-types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type NarrativeInput = {
  inputs: SimulationInputsState;
  baseline: SimulationBaselineData;
  estimates: SimulationEstimates;
};

export type NarrativeResult = {
  narrative: SimulationNarrative | null;
  retrievedChunks: number;
  query: string;
  error?: string;
};

function budgetBand(php: number): string {
  if (php < 3_000_000) return "low (<₱3M)";
  if (php <= 7_000_000) return "mid (₱3–7M)";
  return "high (>₱7M)";
}

/** Scenario-aware RAG query: extends `buildRAGQuery` with the chosen strategy + ambitions. */
export function buildSimulationQuery(
  baseline: SimulationBaselineData,
  inputs: SimulationInputsState,
): string {
  const context: LocationContext = {
    areaName: baseline.name,
    ndvi: baseline.ndvi,
    lst: baseline.lst,
    treeCanopy: baseline.canopyCover,
    greeneryIndex: baseline.greeneryIndex,
  };
  const baseQuery = buildRAGQuery(context);
  const scenarioParts: string[] = [
    `Planned intervention: ${inputs.intervention_type}.`,
    `Canopy gain target: ${inputs.canopy_target_percent}% over ${inputs.time_horizon} years.`,
    `NDVI uplift target: +${inputs.ndvi_target.toFixed(2)}.`,
    `Climate stress: temperature +${inputs.temperature_increase_rate.toFixed(2)}°C/yr, rainfall ${inputs.rainfall_change_rate >= 0 ? "+" : ""}${inputs.rainfall_change_rate}%/yr, flood risk ${inputs.flooding_severity}.`,
    `Programme budget band ${budgetBand(inputs.total_budget_cap)}.`,
    `Discuss effectiveness, cooling and stormwater coefficients, species selection, maintenance, equity, and Philippine tropical context.`,
  ];
  return `${baseQuery} ${scenarioParts.join(" ")}`.trim();
}

function formatBaseline(b: SimulationBaselineData): string {
  return [
    `Area: ${b.name ?? "Unnamed barangay"} (${(b.areaHectares ?? 0).toFixed(2)} ha)`,
    `NDVI: ${b.ndvi}`,
    `LST: ${b.lst}°C`,
    `Tree canopy: ${b.canopyCover}`,
    `Greenery Index: ${b.greeneryIndex}`,
    `Flood exposure: ${b.floodExposure}`,
    `Current intervention: ${b.currentIntervention}`,
  ].join("\n");
}

function formatEstimates(e: SimulationEstimates): string {
  const lines: string[] = [];
  lines.push("Per-metric projections (mid value with low–high band):");
  for (const m of e.metrics) {
    lines.push(
      `- ${m.label} (${m.key}): baseline ${m.baseline}${m.unit}, projected ${m.projected}${m.unit} (range ${m.low}–${m.high}). Direction: ${m.direction}. ${m.note ?? ""}`.trim(),
    );
  }
  lines.push("");
  lines.push("Barangay-total impact:");
  for (const a of e.barangayTotals) {
    lines.push(
      `- ${a.label}: ${a.value.toLocaleString()} ${a.unit}${a.note ? ` (${a.note})` : ""}`,
    );
  }
  lines.push("");
  lines.push(
    `Final Greenery Index: ${e.finalGI.gi_score} (${e.finalGI.gi_level}). Budget binding: ${e.costProjection.budgetBinding}. Realized canopy gain: ${e.costProjection.realizedCanopyPercent}%. Total programme cost: ₱${e.costProjection.totalPHP.toLocaleString()}.`,
  );
  if (e.warnings.length > 0) {
    lines.push("");
    lines.push("Engine warnings:");
    for (const w of e.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

function formatChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0)
    return "No specific research excerpts retrieved; rely on general urban-greening knowledge but say so.";
  return chunks
    .map(
      (c, i) =>
        `[SOURCE ${i + 1}: "${c.studyTitle}" (similarity ${c.similarity.toFixed(2)})]\n${c.content}`,
    )
    .join("\n\n---\n\n");
}

const SYSTEM_PROMPT = `You are a Philippine urban-greening analyst.
You will receive a deterministic simulation result (numeric estimates with low/high bands and warnings),
the location's baseline metrics, and excerpts from peer-reviewed studies retrieved via RAG.

Your job:
1. Explain in 2–4 sentences WHY the chosen strategy is effective for THIS barangay,
   referencing baseline metrics and which retrieved studies back the cooling/stormwater/air-quality claims.
2. List 2–4 SHORTCOMINGS or risks (maintenance burden, mismatch with baseline,
   equity gaps, climate uncertainty, species risk, time-to-effect, etc.).
3. Provide 1–2 sentences on SENSITIVITY — what input the user should pay
   most attention to and why.
4. For each metric (LST, NDVI, canopy, GI, stormwater, PM2.5, NO2, CO2 — only
   when relevant) cite the supporting study by title and a one-line excerpt.
5. Optionally suggest one ALTERNATIVE strategy if the chosen one is a poor fit.

HARD RULES:
- Do NOT invent numbers. Only refer to the figures in the simulation block.
- Cite source studies only by their exact titles as provided in the SOURCE blocks.
- Keep prose plain and direct. No marketing language. No emojis.
- Return ONLY a JSON object with this shape:
  {
    "effectivenessRationale": string,
    "shortcomings": string[],
    "sensitivityNarrative": string,
    "metricCitations": { [metricKey]: { studyTitle: string, excerpt: string }[] },
    "alternativeStrategy": { "name": string, "reason": string } | null
  }`;

function buildUserPrompt(input: NarrativeInput, chunks: RetrievedChunk[]): string {
  return `## BASELINE
${formatBaseline(input.baseline)}

## SCENARIO INPUTS
- intervention_type: ${input.inputs.intervention_type}
- canopy_target_percent: ${input.inputs.canopy_target_percent}
- ndvi_target: ${input.inputs.ndvi_target}
- temperature_increase_rate: ${input.inputs.temperature_increase_rate} °C/yr
- rainfall_change_rate: ${input.inputs.rainfall_change_rate} %/yr
- flooding_severity: ${input.inputs.flooding_severity}
- total_budget_cap: ₱${input.inputs.total_budget_cap.toLocaleString()}
- cost_per_sqm: ₱${input.inputs.cost_per_sqm}
- maintenance_cost_rate: ${input.inputs.maintenance_cost_rate}%/yr
- time_horizon: ${input.inputs.time_horizon} years

## ENGINE OUTPUT
${formatEstimates(input.estimates)}

## RESEARCH EVIDENCE
${formatChunks(chunks)}

Return only the JSON object described in the system prompt.`;
}

function coerceNarrative(raw: unknown): SimulationNarrative | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const effectiveness =
    typeof r.effectivenessRationale === "string" ? r.effectivenessRationale : "";
  if (!effectiveness) return null;

  const shortcomings = Array.isArray(r.shortcomings)
    ? (r.shortcomings.filter((s) => typeof s === "string") as string[])
    : [];

  const sensitivityNarrative =
    typeof r.sensitivityNarrative === "string" ? r.sensitivityNarrative : "";

  const metricCitations: SimulationNarrative["metricCitations"] = {};
  if (r.metricCitations && typeof r.metricCitations === "object") {
    for (const [k, v] of Object.entries(
      r.metricCitations as Record<string, unknown>,
    )) {
      if (!Array.isArray(v)) continue;
      const list = v
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const e = entry as Record<string, unknown>;
          const title = typeof e.studyTitle === "string" ? e.studyTitle : null;
          const excerpt = typeof e.excerpt === "string" ? e.excerpt : "";
          if (!title) return null;
          return { studyTitle: title, excerpt };
        })
        .filter(
          (x): x is { studyTitle: string; excerpt: string } => x !== null,
        );
      if (list.length > 0)
        (metricCitations as Record<string, typeof list>)[k] = list;
    }
  }

  let alternativeStrategy: SimulationNarrative["alternativeStrategy"];
  if (r.alternativeStrategy && typeof r.alternativeStrategy === "object") {
    const a = r.alternativeStrategy as Record<string, unknown>;
    if (typeof a.name === "string" && typeof a.reason === "string") {
      alternativeStrategy = { name: a.name, reason: a.reason };
    }
  }

  return {
    effectivenessRationale: effectiveness,
    shortcomings,
    sensitivityNarrative,
    metricCitations,
    citedStudies: [],
    alternativeStrategy,
  };
}

export async function generateSimulationNarrative(
  input: NarrativeInput,
): Promise<NarrativeResult> {
  const query = buildSimulationQuery(input.baseline, input.inputs);
  let chunks: RetrievedChunk[] = [];

  try {
    const rag = await retrieveRelevantChunksByQuery(query, 6);
    chunks = rag.chunks;
  } catch (e) {
    console.error("Simulation RAG retrieval failed:", e);
  }

  const citedStudies = Array.from(
    new Map(
      chunks.map((c) => [c.studyTitle, c.similarity]),
    ).entries(),
  )
    .map(([studyTitle, similarity]) => ({ studyTitle, similarity }))
    .sort((a, b) => b.similarity - a.similarity);

  if (!process.env.OPENAI_API_KEY) {
    return {
      narrative: null,
      retrievedChunks: chunks.length,
      query,
      error: "OPENAI_API_KEY missing — narrative skipped.",
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input, chunks) },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        narrative: null,
        retrievedChunks: chunks.length,
        query,
        error: "LLM returned invalid JSON.",
      };
    }
    const narrative = coerceNarrative(parsed);
    if (!narrative) {
      return {
        narrative: null,
        retrievedChunks: chunks.length,
        query,
        error: "LLM JSON missing required fields.",
      };
    }
    narrative.citedStudies = citedStudies;
    return { narrative, retrievedChunks: chunks.length, query };
  } catch (e) {
    return {
      narrative: null,
      retrievedChunks: chunks.length,
      query,
      error: e instanceof Error ? e.message : "LLM call failed.",
    };
  }
}
