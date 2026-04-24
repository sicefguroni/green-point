/**
 * POST /api/simulation/run
 *
 * Runs the deterministic greening simulation engine and, in parallel, asks
 * an LLM (grounded in RAG-retrieved studies) to explain WHY the chosen
 * strategy is effective for this barangay, what its shortcomings are, and
 * which study supports each metric. Engine results are always returned;
 * narrative falls back to `null` if the LLM fails or is misconfigured.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runSimulationEngine } from "@/lib/simulation/engine";
import { generateSimulationNarrative } from "@/lib/simulation/narrative";
import type {
  SimulationBaselineData,
  SimulationInputsState,
  SimulationResultsState,
} from "@/components/ui/simulation/simulation-types";

const InputsSchema = z.object({
  temperature_increase_rate: z.number().min(0).max(1),
  flooding_severity: z.enum(["low", "medium", "high"]),
  rainfall_change_rate: z.number().min(-50).max(100),
  canopy_target_percent: z.number().min(0).max(80),
  ndvi_target: z.number().min(0).max(0.6),
  intervention_type: z.string().min(1),
  total_budget_cap: z.number().min(0),
  cost_per_sqm: z.number().min(1),
  maintenance_cost_rate: z.number().min(0).max(50),
  time_horizon: z.number().int().min(1).max(30),
});

const BaselineSchema = z.object({
  name: z.string().optional(),
  ndvi: z.number(),
  lst: z.number(),
  floodExposure: z.string(),
  greeneryIndex: z.number(),
  canopyCover: z.number(),
  currentIntervention: z.string(),
  areaHectares: z.number().positive().optional(),
});

const BodySchema = z.object({
  inputs: InputsSchema,
  baseline: BaselineSchema,
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid simulation request.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const inputs: SimulationInputsState = parsed.data.inputs as SimulationInputsState;
  const baseline: SimulationBaselineData = parsed.data.baseline;

  let estimates;
  try {
    estimates = runSimulationEngine({ inputs, baseline });
  } catch (e) {
    console.error("Simulation engine failed:", e);
    return NextResponse.json(
      { success: false, error: "Simulation engine error." },
      { status: 500 },
    );
  }

  const narrativeResult = await generateSimulationNarrative({
    inputs,
    baseline,
    estimates,
  });

  const payload: SimulationResultsState = {
    estimates,
    narrative: narrativeResult.narrative,
    meta: {
      retrievedChunks: narrativeResult.retrievedChunks,
      query: narrativeResult.query,
      narrativeError: narrativeResult.error,
    },
  };

  return NextResponse.json({ success: true, data: payload });
}
