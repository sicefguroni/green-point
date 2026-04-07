-- AlterTable
ALTER TABLE "GreeningRecommendation"
ADD COLUMN "costEstimate" JSONB,
ADD COLUMN "costEstimateUpdatedAt" TIMESTAMP(3);
