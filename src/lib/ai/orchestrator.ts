import "server-only";

import { getProviderOrder } from "./config";
import { generateJsonWithGemini } from "./gemini";
import { generateJsonWithOpenAI } from "./openai";
import { AIProviderConfigError } from "./provider-errors";
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
    // The last failure from a provider that actually ran. A fallback that is
    // merely not configured should not hide why the primary failed.
    let lastAttemptError: unknown = null;

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
      if (!(error instanceof AIProviderConfigError)) lastAttemptError = error;

      // Any primary-provider failure (bad model, rejected params, auth, outage,
      // an answer `parse` rejects) still gives the fallback provider a chance.
      const hasAnotherProvider = index < providerOrder.length - 1;
      if (hasAnotherProvider) {
        console.warn(
          `AI provider "${provider}" failed for ${request.feature}; falling back to "${providerOrder[index + 1]}".`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  const finalError = lastAttemptError ?? lastError;
  throw finalError instanceof Error
    ? finalError
    : new Error("All AI providers failed.");
}