import "server-only";

import { getModelForFeature } from "./config";
import {
  AIProviderConfigError,
  AIProviderRequestError,
  createProviderRequestError,
} from "./provider-errors";
import type { AIJsonTextRequest, AIProviderTextResult } from "./types";

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

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new AIProviderConfigError("gemini", "Missing GEMINI_API_KEY");
  }

  return apiKey;
}

function buildGeminiApiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function extractReply(data: GeminiGenerateContentResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim() || "")
      .filter(Boolean)
      .join("\n") || ""
  );
}

function isRetryableGeminiFailure(status: number, message: string) {
  if ([429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  return /high demand|overloaded|rate limit|temporar|unavailable|try again later/i.test(
    message,
  );
}

export async function generateJsonWithGemini(
  request: AIJsonTextRequest,
): Promise<AIProviderTextResult> {
  const apiKey = getGeminiApiKey();
  const model = getModelForFeature("gemini", request.feature);

  try {
    const response = await fetch(buildGeminiApiUrl(model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: request.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: request.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.4,
          topP: request.topP ?? 0.9,
          maxOutputTokens: request.maxOutputTokens ?? 1024,
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    const data = (await response.json()) as GeminiGenerateContentResponse;

    if (!response.ok) {
      const message =
        data.error?.message || `Gemini request failed with ${response.status}`;

      throw new AIProviderRequestError({
        provider: "gemini",
        message,
        status: response.status,
        retryable: isRetryableGeminiFailure(response.status, message),
      });
    }

    if (data.promptFeedback?.blockReason) {
      throw new AIProviderRequestError({
        provider: "gemini",
        message: `Gemini blocked the prompt: ${data.promptFeedback.blockReason}`,
        status: 400,
        retryable: false,
      });
    }

    const rawText = extractReply(data);

    if (!rawText) {
      throw new AIProviderRequestError({
        provider: "gemini",
        message: "Gemini returned an empty response.",
        status: null,
        retryable: false,
      });
    }

    return {
      provider: "gemini",
      model,
      rawText,
    };
  } catch (error) {
    if (
      error instanceof AIProviderConfigError ||
      error instanceof AIProviderRequestError
    ) {
      throw error;
    }

    throw createProviderRequestError(
      "gemini",
      error,
      "Gemini request failed.",
    );
  }
}