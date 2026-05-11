import type { InterventionType } from "@/lib/simulation/coefficients";
import { resolveStrategyKey } from "@/lib/simulation/cost-model";

export type RagStrategyHandoffCard = {
  /** Canonical strategy the engine will run when this row is chosen. */
  id: InterventionType;
  /** Same 0–100 composite as Explore sidebar cards (`/api/recommendations/generate`). */
  overallRating: number;
  /** RAG `name` — same headline as Explore. */
  headline: string;
  /** RAG `summary` when present. */
  summary?: string;
};

/**
 * One simulation card per Explore/RAG row, preserving API order and scores
 * (no dedupe, no planner reranking).
 */
export function buildRagStrategyCardsForSimulation(
  recs:
    | readonly {
        interventionType: string;
        overallRating: number;
        name?: string;
        summary?: string;
      }[]
    | null
    | undefined,
): RagStrategyHandoffCard[] | undefined {
  if (!recs?.length) return undefined;
  const cards: RagStrategyHandoffCard[] = [];
  for (const rec of recs) {
    const id = resolveStrategyKey(rec.interventionType);
    const r = Number(rec.overallRating);
    const overallRating = Number.isFinite(r) ? r : 0;
    const headline = (rec.name ?? "").trim();
    cards.push({
      id,
      overallRating,
      headline: headline.length > 0 ? headline : id,
      summary:
        typeof rec.summary === "string" && rec.summary.trim().length > 0
          ? rec.summary.trim()
          : undefined,
    });
  }
  return cards.length > 0 ? cards : undefined;
}
