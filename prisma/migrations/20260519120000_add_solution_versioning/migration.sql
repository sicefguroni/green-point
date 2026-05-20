-- Add versioning columns to SavedSolution
ALTER TABLE "SavedSolution"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "previousVersionId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "contextSnapshot" TYPE JSONB USING "contextSnapshot"::jsonb;