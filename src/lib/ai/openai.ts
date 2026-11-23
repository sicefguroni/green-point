import "server-only";

import OpenAI from "openai";
import { getModelForProvider } from "./config";
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

// Reasoning models (e.g. GPT-5 family, o-series) reject non-default sampling params.
const modelsWithoutSamplingParams = new Set<string>();

function isUnsupportedSamplingParamError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;

  const status = (error as { status?: unknown }).status;
  const message = error instanceof Error ? error.message : "";

  return (
    status === 400 &&
    /unsupported/i.test(message) &&
    /temperature|top_p/i.test(message)
  );
}

export async function generateJsonWithOpenAI(
  request: AIJsonTextRequest,
): Promise<AIProviderTextResult> {
  const apiKey = getOpenAIApiKey();
  const model = getModelForProvider("openai");

  try {
    const client = new OpenAI({ apiKey });

    const hasSamplingParams =
      request.temperature !== undefined || request.topP !== undefined;
    const userContent = request.images?.length
      ? [
          { type: "text" as const, text: request.userPrompt },
          ...request.images.map((image) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:${image.mimeType};base64,${image.base64}`,
              detail: "low" as const,
            },
          })),
        ]
      : request.userPrompt;

    const createCompletion = (includeSamplingParams: boolean) =>
      client.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          ...(includeSamplingParams && request.temperature !== undefined
            ? { temperature: request.temperature }
            : {}),
          ...(includeSamplingParams && request.topP !== undefined
            ? { top_p: request.topP }
            : {}),
          ...(request.maxOutputTokens !== undefined
            ? { max_completion_tokens: request.maxOutputTokens }
            : {}),
        },
        request.timeoutMs ? { timeout: request.timeoutMs } : undefined,
      );

    let completion;
    if (!hasSamplingParams || modelsWithoutSamplingParams.has(model)) {
      completion = await createCompletion(false);
    } else {
      try {
        completion = await createCompletion(true);
      } catch (error) {
        if (!isUnsupportedSamplingParamError(error)) throw error;

        modelsWithoutSamplingParams.add(model);
        completion = await createCompletion(false);
      }
    }

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