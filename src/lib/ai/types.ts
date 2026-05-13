export type AIProviderName = "openai" | "gemini";

export type AIFeatureName = 
    | "chat"
    | "recommendations"
    | "simulationNarrative"
    | "visionAnalysis";

export interface AIJsonTextRequest {
    feature: AIFeatureName;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
}

export interface AIProviderTextResult {
    provider: AIProviderName;
    model: string;
    rawText: string;
}