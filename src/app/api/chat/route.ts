import { NextRequest, NextResponse } from "next/server";
import {
  buildRAGQuery,
  retrieveRelevantChunksByQuery,
  type LocationContext,
  type RetrievedChunk,
} from "@/lib/rag";
import {
  MAX_CHATBOT_SYSTEM_PROMPT_LENGTH,
  normalizeSystemPromptOverride,
} from "@/lib/ai/chat-prompt";
import type { ChatRequestPayload } from "@/types/chat";
import type { AssistantSource } from "@/types/green_solutions";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types & Validation (from chore/ui-enhance)
// ---------------------------------------------------------------------------

type ValidationResult =
  | { ok: true; value: ChatRequestPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePayload(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const {
    messages,
    recommendation,
    selectedFeature,
    selectedBarangayData,
    systemPromptOverride,
  } = value;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "messages must contain at least one chat message." };
  }

  const validMessages = messages.every((message) => {
    if (!isRecord(message)) return false;
    return (
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    );
  });

  if (!validMessages) {
    return { ok: false, error: "Each message must include a valid role and non-empty content." };
  }

  if (
    !isRecord(recommendation) ||
    typeof recommendation.title !== "string" ||
    recommendation.title.trim().length === 0 ||
    typeof recommendation.description !== "string" ||
    recommendation.description.trim().length === 0
  ) {
    return {
      ok: false,
      error: "recommendation must include a title and description.",
    };
  }

  if (
    !isRecord(selectedFeature) ||
    typeof selectedFeature.name !== "string" ||
    selectedFeature.name.trim().length === 0 ||
    typeof selectedFeature.address !== "string" ||
    selectedFeature.address.trim().length === 0 ||
    !isRecord(selectedFeature.coords) ||
    !isFiniteNumber(selectedFeature.coords.lat) ||
    !isFiniteNumber(selectedFeature.coords.lng)
  ) {
    return {
      ok: false,
      error: "selectedFeature must include name, address, and numeric coordinates.",
    };
  }

  if (selectedBarangayData !== undefined && selectedBarangayData !== null) {
    if (
      !isRecord(selectedBarangayData) ||
      typeof selectedBarangayData.name !== "string" ||
      !isFiniteNumber(selectedBarangayData.greeneryIndex) ||
      !isFiniteNumber(selectedBarangayData.ndvi) ||
      !isFiniteNumber(selectedBarangayData.lst) ||
      !isFiniteNumber(selectedBarangayData.treeCanopy) ||
      typeof selectedBarangayData.floodExposure !== "string" ||
      typeof selectedBarangayData.currentIntervention !== "string"
    ) {
      return {
        ok: false,
        error: "selectedBarangayData is malformed.",
      };
    }
  }

  if (
    systemPromptOverride !== undefined &&
    systemPromptOverride !== null &&
    (typeof systemPromptOverride !== "string" ||
      systemPromptOverride.trim().length > MAX_CHATBOT_SYSTEM_PROMPT_LENGTH)
  ) {
    return {
      ok: false,
      error: `systemPromptOverride must be a string up to ${MAX_CHATBOT_SYSTEM_PROMPT_LENGTH} characters.`,
    };
  }

  return {
    ok: true,
    value: {
      ...(value as ChatRequestPayload),
      systemPromptOverride: normalizeSystemPromptOverride(systemPromptOverride),
    },
  };
}

// ---------------------------------------------------------------------------
// RAG Helpers (adapted from dev)
// ---------------------------------------------------------------------------

function createLocationContext(payload: ChatRequestPayload): LocationContext {
  const barangay = payload.selectedBarangayData;
  const feature = payload.selectedFeature;
  
  return {
    areaName: feature.barangay || feature.name,
    ndvi: barangay?.ndvi ?? undefined,
    lst: barangay?.lst ?? undefined,
    treeCanopy: barangay?.treeCanopy ?? undefined,
    greeneryIndex: barangay?.greeneryIndex ?? undefined,
    floodHazard: feature.hazardSummary?.floodLevels?.length 
      ? Math.max(...feature.hazardSummary.floodLevels) 
      : undefined,
    stormHazard: feature.hazardSummary?.stormLevels?.length 
      ? Math.max(...feature.hazardSummary.stormLevels) 
      : undefined,
    aqi: undefined, // Not currently available in ChatRequestPayload
  };
}

function buildAssistantQuery(
  payload: ChatRequestPayload,
  locationContext: LocationContext,
): string {
  const latestUserMessage = [...payload.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  return [
    buildRAGQuery(locationContext),
    `Selected intervention: ${payload.recommendation.title}.`,
    `Intervention type: ${payload.recommendation.interventionType || "N/A"}.`,
    latestUserMessage ? `User question: ${latestUserMessage}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatSources(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No retrieved study excerpts are available for this turn.";
  }

  return chunks
    .slice(0, 4)
    .map(
      (chunk, index) =>
        `[SOURCE ${index + 1}] ${chunk.studyTitle} (${chunk.studyID})\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}

function dedupeSources(chunks: RetrievedChunk[]): AssistantSource[] {
  const seen = new Set<string>();
  const unique: AssistantSource[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.studyTitle)) {
      continue;
    }
    seen.add(chunk.studyTitle);
    unique.push({
      studyID: chunk.studyID,
      studyTitle: chunk.studyTitle,
      similarity: chunk.similarity,
    });
  }

  return unique.slice(0, 3);
}

function selectResponseSources(
  availableSources: AssistantSource[],
  citedSources: string[] | undefined,
  reply: string,
  mode: "grounded" | "general",
): AssistantSource[] {
  const selectedTitles = new Set((citedSources ?? []).filter(Boolean));

  if (selectedTitles.size === 0) {
    for (const source of availableSources) {
      if (reply.includes(source.studyTitle)) {
        selectedTitles.add(source.studyTitle);
      }
    }
  }

  if (selectedTitles.size === 0 && mode === "grounded") {
    return availableSources.slice(0, 2);
  }

  const matchedSources = availableSources.filter((source) =>
    selectedTitles.has(source.studyTitle),
  );

  if (matchedSources.length === 0 && mode === "grounded") {
    return availableSources.slice(0, 2);
  }

  return matchedSources;
}

// ---------------------------------------------------------------------------
// Gemini Call (adapted from lib/ai/gemini.ts)
// ---------------------------------------------------------------------------

async function callGemini(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

// ---------------------------------------------------------------------------
// Main POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json(
      { reply: "", error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const validation = validatePayload(rawPayload);
  if (!validation.ok) {
    return NextResponse.json(
      { reply: "", error: validation.error },
      { status: 400 },
    );
  }

  const payload = validation.value;

  try {
    const locationContext = createLocationContext(payload);
    const ragQuery = buildAssistantQuery(payload, locationContext);

    let chunks: RetrievedChunk[] = [];
    try {
      const ragResult = await retrieveRelevantChunksByQuery(ragQuery, 4);
      chunks = ragResult.chunks;
    } catch (error) {
      console.warn("Assistant RAG retrieval failed; continuing with general context.", error);
    }

    const baseSystemPrompt = `You are GreenPoint AI, a practical assistant for urban greening work in Mandaue City, Philippines.

You operate in two modes:
- grounded: When the user asks about the selected intervention, site conditions, implementation steps, costs, benefits, hazards, planning, or other urban-greening decisions, answer using the provided recommendation, location metrics, and retrieved studies.
- general: When the user asks for normal conversation, brainstorming, writing help, or broader discussion beyond the retrieved studies, answer naturally and helpfully without pretending the research covers it.

Rules:
- Be concise, practical, and direct.
- Do not invent study titles or citations.
- If you use retrieved studies, mention the study title naturally in the reply.
- If the question is not research-bound, you may answer generally while still staying relevant to the GreenPoint context when useful.
- Return only a JSON object with keys: reply, mode, citedSources.
- mode must be either grounded or general.
- citedSources must be an array of study titles actually used in the answer.`;

    const systemPrompt = payload.systemPromptOverride 
      ? `${baseSystemPrompt}\n\nAdditional Instruction:\n${payload.systemPromptOverride}`
      : baseSystemPrompt;

    const userPrompt = `## Selected intervention
Title: ${payload.recommendation.title}
Description: ${payload.recommendation.description}
Type: ${payload.recommendation.interventionType || "N/A"}
Efficiency level: ${payload.recommendation.efficiencyLevel || "N/A"}
Efficiency score: ${payload.recommendation.efficiencyScore?.toFixed(2) || "N/A"}
Equity index: ${payload.recommendation.equityIndex?.toFixed(2) || "N/A"}
Cost index: ${payload.recommendation.costIndex?.toFixed(2) || "N/A"}
Impact score: ${payload.recommendation.impactScore?.toFixed(2) || "N/A"}
Estimated cost: ${payload.recommendation.estimatedCost?.toFixed(2) || "N/A"} ${payload.recommendation.costUnit || ""}

## Site context
Location: ${payload.selectedFeature.name}
Address: ${payload.selectedFeature.address}
Barangay: ${payload.selectedFeature.barangay || "Unknown"}
NDVI: ${locationContext.ndvi ?? "N/A"}
LST: ${locationContext.lst ?? "N/A"}
Tree canopy: ${locationContext.treeCanopy ?? "N/A"}
Greenery index: ${locationContext.greeneryIndex ?? "N/A"}
Flood hazard: ${locationContext.floodHazard ?? "N/A"}
Storm hazard: ${locationContext.stormHazard ?? "N/A"}
Current intervention context: ${payload.selectedBarangayData?.currentIntervention ?? "Not provided"}
Flood exposure label: ${payload.selectedBarangayData?.floodExposure ?? "Not provided"}

## Retrieved studies
${formatSources(chunks)}

## Conversation
${payload.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n")}`;

    const rawText = await callGemini(systemPrompt, userPrompt);
    
    let parsed: {
      reply?: string;
      mode?: "grounded" | "general";
      citedSources?: string[];
    };
    
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.warn("Gemini returned non-JSON; falling back to raw text as reply.");
      parsed = { reply: rawText, mode: "general", citedSources: [] };
    }

    const replyText =
      parsed.reply?.trim() ||
      "I couldn't form a useful answer for that request. Please try rephrasing it.";
    const mode = parsed.mode === "grounded" ? "grounded" : "general";
    const availableSources = dedupeSources(chunks);

    // Return the response. 
    // The UI (ChatTab.tsx) expects { reply, error? }.
    // We include sources and mode for compatibility and future use.
    return NextResponse.json({
      reply: replyText,
      mode,
      sources: selectResponseSources(
        availableSources,
        parsed.citedSources,
        replyText,
        mode,
      ),
      query: ragQuery,
    });
  } catch (error) {
    console.error("Assistant chat failed:", error);
    
    const isMissingApiKey =
      error instanceof Error && error.message === "Missing GEMINI_API_KEY";

    return NextResponse.json(
      { 
        reply: isMissingApiKey
          ? "AI chat is not configured yet. Set GEMINI_API_KEY on the server to enable the GreenPoint assistant."
          : "I’m having trouble responding right now. Please try again in a moment.",
        error: error instanceof Error ? error.message : "Failed to generate assistant reply." 
      },
      { status: 500 },
    );
  }
}