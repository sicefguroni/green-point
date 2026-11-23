import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SimulationBaselineData,
  SimulationInputsState,
} from "@/components/ui/simulation/simulation-types";
import { AIProviderConfigError, AIProviderRequestError } from "@/lib/ai/provider-errors";

const { generateJsonWithFallback } = vi.hoisted(() => ({
  generateJsonWithFallback: vi.fn(),
}));

vi.mock("@/lib/ai/orchestrator", () => ({ generateJsonWithFallback }));
vi.mock("@/lib/rag", () => ({
  buildRAGQuery: vi.fn(() => "query"),
  retrieveRelevantChunksByQuery: vi.fn(async () => ({ chunks: [], query: "query" })),
}));

import { runSimulationEngine } from "./engine";
import { generateSimulationNarrative } from "./narrative";

const inputs: SimulationInputsState = {
  temperature_increase_rate: 0.03,
  flooding_severity: "medium",
  rainfall_change_rate: 5,
  canopy_target_percent: 15,
  ndvi_target: 0.1,
  intervention_type: "urban canopy",
  total_budget_cap: 5_000_000,
  cost_per_sqm: 35,
  maintenance_cost_rate: 8,
  time_horizon: 5,
} as SimulationInputsState;

const baseline: SimulationBaselineData = {
  name: "Test",
  ndvi: 0.4,
  lst: 33,
  floodExposure: "Medium",
  greeneryIndex: 0.55,
  canopyCover: 25,
  currentIntervention: "Urban Canopy",
  areaHectares: 50,
} as SimulationBaselineData;

const input = { inputs, baseline, estimates: runSimulationEngine({ inputs, baseline }) };

/** Runs the caller's own `parse` on `rawText`, as the orchestrator does. */
function answerWith(rawText: string) {
  generateJsonWithFallback.mockImplementationOnce(
    async (request: { parse: (raw: string) => unknown }) => ({
      provider: "gemini",
      model: "m",
      rawText,
      value: request.parse(rawText),
    }),
  );
}

describe("generateSimulationNarrative", () => {
  beforeEach(() => {
    generateJsonWithFallback.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("uses the fallback chain instead of calling OpenAI directly", async () => {
    answerWith(JSON.stringify({ effectivenessRationale: "Shade lowers LST." }));

    const result = await generateSimulationNarrative(input);

    expect(result.narrative?.effectivenessRationale).toBe("Shade lowers LST.");
    expect(result.error).toBeUndefined();
    expect(generateJsonWithFallback.mock.calls[0][0].feature).toBe("simulationNarrative");
  });

  it("never sends the provider's own error message to the browser", async () => {
    generateJsonWithFallback.mockRejectedValueOnce(
      new AIProviderRequestError({
        provider: "openai",
        message: "401 Incorrect API key provided: sk-proj-****abcd",
        status: 401,
        retryable: false,
      }),
    );

    const result = await generateSimulationNarrative(input);

    expect(result.narrative).toBeNull();
    expect(result.error).toBe(
      "The AI service is unavailable right now, so the narrative was skipped. The engine results above are unaffected.",
    );
  });

  it("says when no provider is set up", async () => {
    generateJsonWithFallback.mockRejectedValueOnce(
      new AIProviderConfigError("openai", "Missing OPENAI_API_KEY"),
    );

    const result = await generateSimulationNarrative(input);

    expect(result.error).toMatch(/aren’t set up on this server/);
    expect(result.error).not.toMatch(/OPENAI_/);
  });

  it("rejects an answer without the required fields so the fallback can try", async () => {
    answerWith(JSON.stringify({ shortcomings: [] }));

    const result = await generateSimulationNarrative(input);

    expect(result.narrative).toBeNull();
    expect(result.error).toBe(
      "The AI returned an incomplete narrative. Run the simulation again to retry.",
    );
  });
});
