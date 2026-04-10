import { NextRequest, NextResponse } from "next/server";

import { generateChatReply } from "@/lib/ai/gemini";
import type { ChatRequestPayload } from "@/types/chat";

export const runtime = "nodejs";

type ValidationResult =
  | { ok: true; value: ChatRequestPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePayload(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const { messages, recommendation, selectedFeature, selectedBarangayData } = value;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "messages must contain at least one chat message." };
  }

  const validMessages = messages.every((message) => {
    if (!isRecord(message)) return false;
    return (
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    );
  });

  if (!validMessages) {
    return { ok: false, error: "Each message must include a valid role and non-empty content." };
  }

  if (
    !isRecord(recommendation) ||
    typeof recommendation.title !== "string" ||
    recommendation.title.trim().length === 0 ||
    typeof recommendation.description !== "string" ||
    recommendation.description.trim().length === 0
  ) {
    return {
      ok: false,
      error: "recommendation must include a title and description.",
    };
  }

  if (
    !isRecord(selectedFeature) ||
    typeof selectedFeature.name !== "string" ||
    selectedFeature.name.trim().length === 0 ||
    typeof selectedFeature.address !== "string" ||
    selectedFeature.address.trim().length === 0 ||
    !isRecord(selectedFeature.coords) ||
    !isFiniteNumber(selectedFeature.coords.lat) ||
    !isFiniteNumber(selectedFeature.coords.lng)
  ) {
    return {
      ok: false,
      error: "selectedFeature must include name, address, and numeric coordinates.",
    };
  }

  if (
    selectedFeature.customSelectionAreaHectares !== undefined &&
    selectedFeature.customSelectionAreaHectares !== null &&
    !isFiniteNumber(selectedFeature.customSelectionAreaHectares)
  ) {
    return {
      ok: false,
      error:
        "selectedFeature.customSelectionAreaHectares must be numeric when provided.",
    };
  }

  if (selectedBarangayData !== undefined && selectedBarangayData !== null) {
    if (
      !isRecord(selectedBarangayData) ||
      typeof selectedBarangayData.name !== "string" ||
      !isFiniteNumber(selectedBarangayData.greeneryIndex) ||
      !isFiniteNumber(selectedBarangayData.ndvi) ||
      !isFiniteNumber(selectedBarangayData.lst) ||
      !isFiniteNumber(selectedBarangayData.treeCanopy) ||
      typeof selectedBarangayData.floodExposure !== "string" ||
      typeof selectedBarangayData.currentIntervention !== "string"
    ) {
      return {
        ok: false,
        error: "selectedBarangayData is malformed.",
      };
    }
  }

  return { ok: true, value: value as unknown as ChatRequestPayload };
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { reply: "", error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    return NextResponse.json(
      { reply: "", error: validation.error },
      { status: 400 },
    );
  }

  try {
    const reply = await generateChatReply(validation.value);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);

    const isMissingApiKey =
      error instanceof Error && error.message === "Missing GEMINI_API_KEY";

    return NextResponse.json(
      {
        reply: isMissingApiKey
          ? "AI chat is not configured yet. Set GEMINI_API_KEY on the server to enable the GreenPoint assistant."
          : "I’m having trouble responding right now. Please try again in a moment.",
        error: error instanceof Error ? error.message : "Unknown chat error",
      },
      { status: 500 },
    );
  }
}