import type { AIFeatureName, AIProviderName } from "./types";

const DEFAULT_PRIMARY_PROVIDER: AIProviderName = "openai";
const DEFAULT_FALLBACK_PROVIDER: AIProviderName = "gemini";

const DEFAULT_MODELS: Record<AIProviderName, Record<AIFeatureName, string>> = {
    openai: {
        chat: "gpt-4o-mini",
        recommendations: "gpt-4o-mini",
        simulationNarrative: "gpt-4o-mini",
        visionAnalysis: "gpt-4o-mini",
    },
    gemini: {
        chat: "gemini-2.0-flash",
        recommendations: "gemini-2.0-flash",
        simulationNarrative: "gemini-2.0-flash",
        visionAnalysis: "gemini-2.0-flash",
    }
}

const FEATURE_MODEL_ENV_KEYS: Record<
    AIFeatureName,
    Record<AIProviderName, string>
> = {
    chat: {
        openai: "OPENAI_CHAT_MODEL",
        gemini: "GEMINI_CHAT_MODEL",
    },
    recommendations: {
        openai: "OPENAI_RECOMMENDATIONS_MODEL",
        gemini: "GEMINI_RECOMMENDATIONS_MODEL",
    },
    simulationNarrative: {
        openai: "OPENAI_SIMULATION_MODEL",
        gemini: "GEMINI_SIMULATION_MODEL",
    },
    visionAnalysis: {
        openai: "OPENAI_VISION_MODEL",
        gemini: "GEMINI_VISION_MODEL",
    }
}

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

export function getModelForFeature(
    provider: AIProviderName,
    feature: AIFeatureName,
): string {
    const envKey = FEATURE_MODEL_ENV_KEYS[feature][provider];
    const configuredModel = process.env[envKey]?.trim();

    return configuredModel || DEFAULT_MODELS[provider][feature];
}