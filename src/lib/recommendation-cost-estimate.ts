import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { RetrievedChunk, LocationContext } from "@/lib/rag";
import type { CostEstimate } from "@/types/green_solutions";
import type { TimelineLocationInput, TimelineRecommendationInput } from "@/types/timeline";

import { buildGroundedCostEstimate } from "./cost-grounding";
import { getCostEstimateCoherenceError } from "./cost-estimate-validation";

type RecommendationLookupInput = TimelineRecommendationInput;

type ResolveRecommendationCostEstimateOptions = {
  location?: TimelineLocationInput;
  metrics: LocationContext;
  ragQuery?: string;
  ragChunks?: RetrievedChunk[];
  providedCostEstimate?: CostEstimate | null;
  refreshCostEstimate?: boolean;
};

async function findRecommendationRecord(recommendation: RecommendationLookupInput) {
  const orFilters: Array<{ id?: string; recommendationID?: string }> = [];

  if (recommendation.id) {
    orFilters.push({ id: recommendation.id });
  }
  if (recommendation.recommendationId) {
    orFilters.push({ recommendationID: recommendation.recommendationId });
  }

  if (orFilters.length === 0) {
    return null;
  }

  return prisma.greeningRecommendation.findFirst({
    where: { OR: orFilters },
  });
}

export async function resolveRecommendationCostEstimate(
  recommendation: RecommendationLookupInput,
  options: ResolveRecommendationCostEstimateOptions,
): Promise<CostEstimate> {
  const providedError = options.providedCostEstimate
    ? getCostEstimateCoherenceError(options.providedCostEstimate)
    : null;
  if (providedError) {
    throw new Error(`Provided cost estimate is invalid: ${providedError}`);
  }

  if (options.providedCostEstimate && !options.refreshCostEstimate) {
    return options.providedCostEstimate;
  }

  const recommendationRecord = await findRecommendationRecord(recommendation);
  if (!options.refreshCostEstimate && recommendationRecord?.costEstimate) {
    const persistedError = getCostEstimateCoherenceError(
      recommendationRecord.costEstimate,
    );
    if (!persistedError) {
      return recommendationRecord.costEstimate as unknown as CostEstimate;
    }
  }

  const generated = await buildGroundedCostEstimate({
    interventionType: recommendation.interventionType,
    solutionTitle: recommendation.solutionTitle,
    solutionDescription: recommendation.solutionDescription,
    rationale: recommendation.rationale,
    sourceStudy: recommendation.sourceStudy,
    barangay: options.location?.barangay,
    locationName: options.location?.name,
    metrics: options.metrics,
    ragQuery: options.ragQuery,
    ragChunks: options.ragChunks,
  });

  const generatedError = getCostEstimateCoherenceError(generated);
  if (generatedError) {
    throw new Error(`Generated cost estimate is invalid: ${generatedError}`);
  }

  if (recommendationRecord) {
    await prisma.greeningRecommendation.update({
      where: { id: recommendationRecord.id },
      data: {
        costEstimate: generated as unknown as Prisma.InputJsonValue,
        costEstimateUpdatedAt: new Date(),
      },
    });
  }

  return generated;
}