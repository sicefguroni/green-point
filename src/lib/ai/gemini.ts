import "server-only";

import type { ChatApiMessage, ChatRequestPayload } from "@/types/chat";

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type GeminiRole = "user" | "model";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
}

function formatNumber(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "N/A";
}

function formatList(values: number[] | undefined) {
  if (!values?.length) return "N/A";
  return values.map((value) => formatNumber(value)).join(", ");
}

function buildSystemInstruction(payload: ChatRequestPayload) {
  const { recommendation, selectedFeature, selectedBarangayData } = payload;

  const contextLines = [
    "You are GreenPoint AI, an urban greening advisor for Mandaue City, Cebu, Philippines.",
    "Give practical, concise, implementation-focused guidance grounded in the provided project context.",
    "Use only the supplied metrics as facts. If data is missing, say so plainly instead of inventing details.",
    "When relevant, cover implementation steps, expected benefits, likely constraints, and local considerations for barangay-level planning.",
    "Keep answers short by default, but still specific enough to be actionable.",
    "",
    "Project context:",
    `- Recommendation title: ${recommendation.title}`,
    `- Recommendation description: ${recommendation.description}`,
    `- Intervention type: ${recommendation.interventionType || "N/A"}`,
    `- Efficiency level: ${recommendation.efficiencyLevel || "N/A"}`,
    `- Efficiency score: ${formatNumber(recommendation.efficiencyScore)}`,
    `- Equity index: ${formatNumber(recommendation.equityIndex)}`,
    `- Cost index: ${formatNumber(recommendation.costIndex)}`,
    `- Impact score: ${formatNumber(recommendation.impactScore)}`,
    `- Estimated cost: ${formatNumber(recommendation.estimatedCost)} ${recommendation.costUnit || ""}`.trim(),
    `- Selected place: ${selectedFeature.name}`,
    `- Address: ${selectedFeature.address}`,
    `- Barangay: ${selectedFeature.barangay || selectedBarangayData?.name || "N/A"}`,
    `- Coordinates: ${formatNumber(selectedFeature.coords.lat, 6)}, ${formatNumber(selectedFeature.coords.lng, 6)}`,
    `- Flood hazard levels: ${formatList(selectedFeature.hazardSummary?.floodLevels)}`,
    `- Storm hazard levels: ${formatList(selectedFeature.hazardSummary?.stormLevels)}`,
    `- Air quality observations available: ${selectedFeature.hazardSummary?.airQualityCount ?? 0}`,
  ];

  if (selectedBarangayData) {
    contextLines.push(
      `- Barangay greenery index: ${formatNumber(selectedBarangayData.greeneryIndex)}`,
      `- Barangay NDVI: ${formatNumber(selectedBarangayData.ndvi)}`,
      `- Barangay land surface temperature: ${formatNumber(selectedBarangayData.lst)}`,
      `- Barangay tree canopy: ${formatNumber(selectedBarangayData.treeCanopy)}`,
      `- Barangay flood exposure: ${selectedBarangayData.floodExposure}`,
      `- Current intervention: ${selectedBarangayData.currentIntervention}`,
    );
  }

  return contextLines.join("\n");
}

function normalizeMessages(messages: ChatApiMessage[]) {
  const cleaned = messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0);

  const merged: ChatApiMessage[] = [];
  for (const message of cleaned) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`;
      continue;
    }

    merged.push(message);
  }

  while (merged[0]?.role === "assistant") {
    merged.shift();
  }

  return merged;
}

function toGeminiContents(messages: ChatApiMessage[]) {
  return normalizeMessages(messages).map((message) => ({
    role: (message.role === "assistant" ? "model" : "user") as GeminiRole,
    parts: [{ text: message.content }],
  }));
}

function extractReply(data: GeminiGenerateContentResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim() || "")
      .filter(Boolean)
      .join("\n") || ""
  );
}

export async function generateChatReply(payload: ChatRequestPayload) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const contents = toGeminiContents(payload.messages);
  if (!contents.length) {
    throw new Error("Chat history must include at least one user message");
  }

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemInstruction(payload) }],
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 700,
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  const data = (await response.json()) as GeminiGenerateContentResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini request failed with ${response.status}`);
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
  }

  const reply = extractReply(data);
  if (!reply) {
    throw new Error("Gemini returned an empty reply");
  }

  return reply;
}