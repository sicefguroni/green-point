import "server-only";

import OpenAI from "openai";
import { getModelForFeature } from "./config";
import {
  AIProviderConfigError,
  AIProviderRequestError,
  createProviderRequestError,
} from "./provider-errors";
import type { AIJsonTextRequest, AIProviderTextResult } from "./types";

function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new AIProviderConfigError("openai", "Missing OPENAI_API_KEY");
  }

  return apiKey;
}

export async function generateJsonWithOpenAI(
  request: AIJsonTextRequest,
): Promise<AIProviderTextResult> {
  const apiKey = getOpenAIApiKey();
  const model = getModelForFeature("openai", request.feature);

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: request.temperature ?? 0.4,
      top_p: request.topP ?? 0.9,
      max_completion_tokens: request.maxOutputTokens ?? 1024,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!rawText) {
      throw new AIProviderRequestError({
        provider: "openai",
        message: "OpenAI returned an empty response.",
        status: null,
        retryable: false,
      });
    }

    return {
      provider: "openai",
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
      "openai",
      error,
      "OpenAI request failed.",
    );
  }
}