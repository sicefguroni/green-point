import type { AIProviderName } from "./types";

interface AIProviderRequestErrorInit {
    provider: AIProviderName;
    message: string;
    status: number | null;
    retryable: boolean;
}

export class AIProviderConfigError extends Error {
    readonly provider: AIProviderName;

    constructor(provider: AIProviderName, message: string) {
        super(message);
        this.name = "AIProviderConfigError";
        this.provider = provider;
    }
}

export class AIProviderRequestError extends Error {
    readonly provider: AIProviderName;
    readonly status: number | null;
    readonly retryable: boolean;

    constructor({
        provider,
        message,
        status,
        retryable,
    }: AIProviderRequestErrorInit) {
        super(message);
        this.name = "AIProviderRequestError";
        this.provider = provider;
        this.status = status;
        this.retryable = retryable;
    }
}

export function createProviderRequestError(
    provider: AIProviderName,
    error: unknown,
    fallbackMessage: string,
): AIProviderRequestError {
    const maybeStatus = 
        typeof error === "object" &&
        error !== null && 
        "status" in error
            ? (error as { status?: unknown }).status
            : null;

    const status = typeof maybeStatus === "number" ? maybeStatus : null;

    const message =
        error instanceof Error && error.message.trim().length > 0
            ? error.message
            : fallbackMessage;

    const retryable =
    status !== null
      ? [429, 500, 502, 503, 504].includes(status)
      : /timeout|temporar|overloaded|unavailable|rate limit|network|fetch failed/i.test(
          message,
        );

    return new AIProviderRequestError({
        provider,
        message,
        status,
        retryable,
    });
}

export function isRetryableProviderFailure(error: unknown) {
    if (error instanceof AIProviderConfigError) {
        return true;
    }

    if (error instanceof AIProviderRequestError) {
        return error.retryable;
    }

    return false;
}