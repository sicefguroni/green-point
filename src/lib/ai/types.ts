export type AIProviderName = "openai" | "gemini";

export type AIFeatureName = 
    | "chat"
    | "recommendations"
    | "simulationNarrative"
    | "visionAnalysis";

export interface AIImageInput {
    mimeType: string;
    /** Base64-encoded image bytes, without a `data:` prefix. */
    base64: string;
}

export interface AIJsonTextRequest {
    feature: AIFeatureName;
    systemPrompt: string;
    userPrompt: string;
    /** Images sent alongside the user prompt (photo analysis). */
    images?: AIImageInput[];
    /** Sampling params are sent only when set; otherwise the provider default applies. */
    temperature?: number;
    topP?: number;
    /** Sent only when set; otherwise the provider's own output limit applies. */
    maxOutputTokens?: number;
    /** Per-request timeout in ms (Gemini defaults to 30s, OpenAI to the SDK default). */
    timeoutMs?: number;
}

export interface AIProviderTextResult {
    provider: AIProviderName;
    model: string;
    rawText: string;
}