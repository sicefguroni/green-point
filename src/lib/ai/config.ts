import { AIProviderConfigError } from "./provider-errors";
import type { AIProviderName } from "./types";

const DEFAULT_PRIMARY_PROVIDER: AIProviderName = "openai";
const DEFAULT_FALLBACK_PROVIDER: AIProviderName = "gemini";

const MODEL_ENV_KEYS: Record<AIProviderName, string> = {
    openai: "OPENAI_CHAT_MODEL",
    gemini: "GEMINI_CHAT_MODEL",
};

function normalizeProvider(
    value: string | undefined,
    fallback: AIProviderName,
): AIProviderName {
    if (value === "openai" || value === "gemini") {
        return value;
    }

    return fallback;
}

export function getPrimaryProvider(): AIProviderName {
    return normalizeProvider(
        process.env.AI_PRIMARY_PROVIDER?.trim(),
        DEFAULT_PRIMARY_PROVIDER,
    );
}

export function getFallbackProvider(): AIProviderName | null {
    const primary = getPrimaryProvider();
    const fallback = normalizeProvider(
        process.env.AI_FALLBACK_PROVIDER?.trim(),
        DEFAULT_FALLBACK_PROVIDER,
    );

    return fallback === primary ? null : fallback;
}

export function getProviderOrder(): AIProviderName[] {
    const primary = getPrimaryProvider();
    const fallback = getFallbackProvider();

    return fallback ? [primary, fallback] : [primary];
}

/** Every AI feature uses the model configured in env; there is no hard-coded default. */
export function getModelForProvider(provider: AIProviderName): string {
    const envKey = MODEL_ENV_KEYS[provider];
    const model = process.env[envKey]?.trim();

    if (!model) {
        throw new AIProviderConfigError(provider, `Missing ${envKey}`);
    }

    return model;
}