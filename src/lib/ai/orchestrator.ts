import "server-only";

import { getProviderOrder } from "./config";
import { generateJsonWithGemini } from "./gemini";
import { generateJsonWithOpenAI } from "./openai";
import { isRetryableProviderFailure } from "./provider-errors";
import type {
  AIJsonTextRequest,
  AIProviderName,
  AIProviderTextResult,
} from "./types";

export interface AIJsonFallbackRequest<T> extends AIJsonTextRequest {
    parse: (rawText: string) => T;
}

export interface AIJsonFallbackResponse<T> extends AIProviderTextResult {
  value: T;
}

const JSON_GENERATORS: Record<
    AIProviderName,
    (request: AIJsonTextRequest) => Promise<AIProviderTextResult>
> = {
    openai: generateJsonWithOpenAI,
    gemini: generateJsonWithGemini,
};

export async function generateJsonWithFallback<T>(
    request: AIJsonFallbackRequest<T>,
): Promise<AIJsonFallbackResponse<T>> {
    const providerOrder = getProviderOrder();
    let lastError: unknown = null;

    for (let index = 0; index < providerOrder.length; index += 1) {
    const provider = providerOrder[index];

    try {
      const result = await JSON_GENERATORS[provider](request);

      return {
        ...result,
        value: request.parse(result.rawText),
      };
    } catch (error) {
      lastError = error;

      const hasAnotherProvider = index < providerOrder.length - 1;
      if (!hasAnotherProvider || !isRetryableProviderFailure(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All AI providers failed.");
}