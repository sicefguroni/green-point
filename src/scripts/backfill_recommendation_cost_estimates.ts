import 'dotenv/config';

import { prisma } from '@/lib/prisma';
import { getCostEstimateCoherenceError } from '@/lib/cost-estimate-validation';

type JsonObject = Record<string, unknown>;

function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function findNestedCostEstimate(value: unknown, depth = 0): unknown | null {
  if (depth > 4 || value === null || value === undefined) {
    return null;
  }

  const directError = getCostEstimateCoherenceError(value);
  if (!directError) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findNestedCostEstimate(entry, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  for (const key of [
    'costEstimate',
    'cost_estimate',
    'estimate',
    'groundedCostEstimate',
  ]) {
    if (key in record) {
      const found = findNestedCostEstimate(record[key], depth + 1);
      if (found) {
        return found;
      }
    }
  }

  for (const nestedValue of Object.values(record)) {
    const found = findNestedCostEstimate(nestedValue, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

async function main() {
  const recommendations = (await prisma.greeningRecommendation.findMany({
    select: {
      id: true,
      recommendationID: true,
      implementationOptions: true,
      monitoringMetrics: true,
      costEstimate: true,
    },
  })).filter((recommendation) => recommendation.costEstimate === null);

  let updated = 0;
  let skipped = 0;

  for (const recommendation of recommendations) {
    const candidate =
      findNestedCostEstimate(recommendation.implementationOptions) ??
      findNestedCostEstimate(recommendation.monitoringMetrics);

    if (!candidate) {
      skipped += 1;
      continue;
    }

    await prisma.greeningRecommendation.update({
      where: { id: recommendation.id },
      data: {
        costEstimate: candidate as object,
        costEstimateUpdatedAt: new Date(),
      },
    });
    updated += 1;
  }

  console.log(
    `Backfill complete. Updated ${updated} recommendation(s), skipped ${skipped}.`,
  );
}

main()
  .catch((error) => {
    console.error('Failed to backfill recommendation cost estimates:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });