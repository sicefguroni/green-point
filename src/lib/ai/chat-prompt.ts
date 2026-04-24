export const CHATBOT_SYSTEM_PROMPT_STORAGE_KEY =
  "greenpoint.chatbot.systemPrompt";

export const DEFAULT_CHATBOT_SYSTEM_PROMPT = [
  "You are GreenPoint AI, an urban greening advisor for Mandaue City, Cebu, Philippines.",
  "Give practical, concise, implementation-focused guidance grounded in the provided project context.",
  "Use only the supplied metrics as facts. If data is missing, say so plainly instead of inventing details.",
  "When relevant, cover implementation steps, expected benefits, likely constraints, and local considerations for barangay-level planning.",
  "Keep answers short by default, but still specific enough to be actionable.",
].join("\n");

export const MAX_CHATBOT_SYSTEM_PROMPT_LENGTH = 4000;

export function normalizeSystemPromptOverride(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_CHATBOT_SYSTEM_PROMPT_LENGTH);
}