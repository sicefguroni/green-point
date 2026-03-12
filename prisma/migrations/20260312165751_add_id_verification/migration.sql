-- CreateTable
CREATE TABLE "IDVerification" (
    "id" TEXT NOT NULL,
    "verificationID" TEXT NOT NULL,
    "plannerID" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "documentPath" TEXT,
    "documentFileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedBy" TEXT,
    "verificationDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IDVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IDVerification_verificationID_key" ON "IDVerification"("verificationID");

-- CreateIndex
CREATE UNIQUE INDEX "IDVerification_plannerID_key" ON "IDVerification"("plannerID");

-- CreateIndex
CREATE INDEX "IDVerification_plannerID_idx" ON "IDVerification"("plannerID");

-- CreateIndex
CREATE INDEX "IDVerification_status_idx" ON "IDVerification"("status");

-- AddForeignKey
ALTER TABLE "IDVerification" ADD CONSTRAINT "IDVerification_plannerID_fkey" FOREIGN KEY ("plannerID") REFERENCES "CityPlanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
