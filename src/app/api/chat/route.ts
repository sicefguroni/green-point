import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildRAGQuery,
  retrieveRelevantChunksByQuery,
  type LocationContext,
  type RetrievedChunk,
} from "@/lib/rag";
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantSource,
} from "@/types/green_solutions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function maxHazardLevel(
  hazards: { id: string; level: number | null }[] | undefined,
): number | undefined {
  const levels = (hazards ?? [])
    .map((hazard) => hazard.level)
    .filter((level): level is number => typeof level === "number");

  if (levels.length === 0) {
    return undefined;
  }

  return Math.max(...levels);
}

function createLocationContext(body: AssistantChatRequest): LocationContext {
  return {
    areaName: body.selectedFeature.barangay || body.selectedFeature.name,
    ndvi: body.selectedBarangayData?.ndvi,
    lst: body.selectedBarangayData?.lst,
    treeCanopy: body.selectedBarangayData?.treeCanopy,
    greeneryIndex: body.selectedBarangayData?.greeneryIndex,
    floodHazard: maxHazardLevel(body.selectedFeature.hazards?.flood),
    stormHazard: maxHazardLevel(body.selectedFeature.hazards?.storm),
  };
}

function buildAssistantQuery(
  body: AssistantChatRequest,
  locationContext: LocationContext,
): string {
  const latestUserMessage = [...body.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  return [
    buildRAGQuery(locationContext),
    `Selected intervention: ${body.recommendation.solutionTitle}.`,
    `Intervention type: ${body.recommendation.interventionType}.`,
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

function isValidBody(body: Partial<AssistantChatRequest>): body is AssistantChatRequest {
  return Boolean(
    body.messages &&
      Array.isArray(body.messages) &&
      body.messages.length > 0 &&
      body.recommendation?.solutionTitle &&
      body.recommendation.solutionDescription &&
      body.selectedFeature?.name &&
      body.selectedFeature.address,
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AssistantChatRequest>;

    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: "Invalid assistant payload." },
        { status: 400 },
      );
    }

    const locationContext = createLocationContext(body);
    const ragQuery = buildAssistantQuery(body, locationContext);

    let chunks: RetrievedChunk[] = [];
    try {
      const ragResult = await retrieveRelevantChunksByQuery(ragQuery, 4);
      chunks = ragResult.chunks;
    } catch (error) {
      console.warn("Assistant RAG retrieval failed; continuing with general context.", error);
    }

    const systemPrompt = `You are GreenPoint AI, a practical assistant for urban greening work in Mandaue City, Philippines.

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

    const userPrompt = `## Selected intervention
Title: ${body.recommendation.solutionTitle}
Description: ${body.recommendation.solutionDescription}
Type: ${body.recommendation.interventionType}
Efficiency level: ${body.recommendation.efficiencyLevel}
Equity index: ${body.recommendation.equityIndex.toFixed(2)}
Cost index: ${body.recommendation.cost.toFixed(2)}
Impact score: ${body.recommendation.impact.toFixed(2)}
Scientific rationale: ${body.recommendation.rationale ?? "Not provided"}
Primary cited study: ${body.recommendation.sourceStudy ?? "Not provided"}

## Site context
Location: ${body.selectedFeature.name}
Address: ${body.selectedFeature.address}
Barangay: ${body.selectedFeature.barangay || "Unknown"}
NDVI: ${locationContext.ndvi ?? "N/A"}
LST: ${locationContext.lst ?? "N/A"}
Tree canopy: ${locationContext.treeCanopy ?? "N/A"}
Greenery index: ${locationContext.greeneryIndex ?? "N/A"}
Flood hazard: ${locationContext.floodHazard ?? "N/A"}
Storm hazard: ${locationContext.stormHazard ?? "N/A"}
Current intervention context: ${body.selectedBarangayData?.currentIntervention ?? "Not provided"}
Flood exposure label: ${body.selectedBarangayData?.floodExposure ?? "Not provided"}

## Retrieved studies
${formatSources(chunks)}

## Conversation
${body.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n")}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(rawText) as {
      reply?: string;
      mode?: "grounded" | "general";
      citedSources?: string[];
    };

    const replyText =
      parsed.reply?.trim() ||
      "I couldn't form a useful answer for that request. Please try rephrasing it.";
    const mode = parsed.mode === "grounded" ? "grounded" : "general";
    const availableSources = dedupeSources(chunks);

    const response: AssistantChatResponse = {
      reply: replyText,
      mode,
      sources: selectResponseSources(
        availableSources,
        parsed.citedSources,
        replyText,
        mode,
      ),
      query: ragQuery,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Assistant chat failed:", error);
    return NextResponse.json(
      { error: "Failed to generate assistant reply." },
      { status: 500 },
    );
  }
}