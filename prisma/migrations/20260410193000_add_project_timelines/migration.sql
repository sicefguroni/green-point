-- CreateTable
CREATE TABLE "ProjectTimeline" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBySupabaseUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTimelineVersion" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "basedOnVersionId" TEXT,
    "changeReason" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "createdBySupabaseUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTimelineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTimeline_recommendationId_key" ON "ProjectTimeline"("recommendationId");

-- CreateIndex
CREATE INDEX "ProjectTimeline_createdBySupabaseUserId_idx" ON "ProjectTimeline"("createdBySupabaseUserId");

-- CreateIndex
CREATE INDEX "ProjectTimeline_status_idx" ON "ProjectTimeline"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTimelineVersion_timelineId_versionNumber_key" ON "ProjectTimelineVersion"("timelineId", "versionNumber");

-- CreateIndex
CREATE INDEX "ProjectTimelineVersion_timelineId_createdAt_idx" ON "ProjectTimelineVersion"("timelineId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectTimelineVersion_basedOnVersionId_idx" ON "ProjectTimelineVersion"("basedOnVersionId");

-- AddForeignKey
ALTER TABLE "ProjectTimeline" ADD CONSTRAINT "ProjectTimeline_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "GreeningRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelineVersion" ADD CONSTRAINT "ProjectTimelineVersion_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "ProjectTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelineVersion" ADD CONSTRAINT "ProjectTimelineVersion_basedOnVersionId_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "ProjectTimelineVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;