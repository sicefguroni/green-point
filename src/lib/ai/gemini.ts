import "server-only";

import {
  DEFAULT_CHATBOT_SYSTEM_PROMPT,
  normalizeSystemPromptOverride,
} from "@/lib/ai/chat-prompt";
import type { ChatApiMessage, ChatRequestPayload } from "@/types/chat";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_FALLBACK_MODELS = ["gemini-2.0-flash-lite", "gemini-2.0-flash"];
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
const GEMINI_MODELS = [
  GEMINI_MODEL,
  ...(process.env.GEMINI_FALLBACK_MODELS
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean) ?? DEFAULT_FALLBACK_MODELS),
].filter((model, index, models) => models.indexOf(model) === index);
const RETRYABLE_GEMINI_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

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

interface GeminiRequestErrorDetails {
  status: number;
  message: string;
}

class GeminiRequestError extends Error {
  readonly status: number;

  constructor({ status, message }: GeminiRequestErrorDetails) {
    super(message);
    this.name = "GeminiRequestError";
    this.status = status;
  }
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
  const {
    recommendation,
    selectedFeature,
    selectedBarangayData,
    systemPromptOverride,
  } = payload;

  const contextLines = [
    normalizeSystemPromptOverride(systemPromptOverride) ||
      DEFAULT_CHATBOT_SYSTEM_PROMPT,
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
    `- Custom area size (hectares): ${formatNumber(selectedFeature.customSelectionAreaHectares)}`,
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

function buildGeminiApiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function isRetryableGeminiError(status: number, message: string) {
  if (RETRYABLE_GEMINI_STATUS_CODES.has(status)) {
    return true;
  }

  return /high demand|overloaded|rate limit|temporar|unavailable|try again later/i.test(
    message,
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestGeminiReply(
  model: string,
  apiKey: string,
  payload: ChatRequestPayload,
  contents: ReturnType<typeof toGeminiContents>,
) {
  const response = await fetch(buildGeminiApiUrl(model), {
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
    throw new GeminiRequestError({
      status: response.status,
      message: data.error?.message || `Gemini request failed with ${response.status}`,
    });
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

export async function generateChatReply(payload: ChatRequestPayload) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const contents = toGeminiContents(payload.messages);
  if (!contents.length) {
    throw new Error("Chat history must include at least one user message");
  }

  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < GEMINI_MODELS.length; modelIndex += 1) {
    const model = GEMINI_MODELS[modelIndex];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await requestGeminiReply(model, apiKey, payload, contents);
      } catch (error) {
        if (!(error instanceof GeminiRequestError)) {
          throw error;
        }

        lastError = error;

        const shouldRetry = isRetryableGeminiError(error.status, error.message);
        const hasAnotherAttemptForModel = attempt === 0;
        const hasAnotherModel = modelIndex < GEMINI_MODELS.length - 1;

        if (!shouldRetry || (!hasAnotherAttemptForModel && !hasAnotherModel)) {
          throw error;
        }

        await wait(600 * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("Gemini request failed");
}