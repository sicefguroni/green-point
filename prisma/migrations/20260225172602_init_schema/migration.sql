-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CITY_PLANNER', 'RESIDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'LOGGED_IN', 'SUSPENDED', 'DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RESIDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'REGISTERED',
    "loginID" TEXT,
    "loginDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Administrator" (
    "id" TEXT NOT NULL,
    "adminID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "managedUsers" TEXT[],
    "managedDatasets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Administrator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityPlanner" (
    "id" TEXT NOT NULL,
    "plannerID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "department" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityPlanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resident" (
    "id" TEXT NOT NULL,
    "residentID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "barangay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "cityID" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "population" INTEGER,
    "area" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityMetrics" (
    "id" TEXT NOT NULL,
    "cityID" TEXT NOT NULL,
    "averageGI" DOUBLE PRECISION,
    "populationDensity" DOUBLE PRECISION,
    "averageTemperature" DOUBLE PRECISION,
    "averageAQI" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barangay" (
    "id" TEXT NOT NULL,
    "barangayID" TEXT NOT NULL,
    "cityID" TEXT NOT NULL,
    "barangayName" TEXT NOT NULL,
    "population" INTEGER,
    "area" DOUBLE PRECISION,
    "populationDensity" DOUBLE PRECISION,
    "boundary" JSONB,
    "coordinates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Barangay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarangayMetrics" (
    "id" TEXT NOT NULL,
    "barangayID" TEXT NOT NULL,
    "NDVI" DOUBLE PRECISION,
    "LST" DOUBLE PRECISION,
    "treeCanopy" DOUBLE PRECISION,
    "greenArea" DOUBLE PRECISION,
    "airQuality" DOUBLE PRECISION,
    "povertyRate" DOUBLE PRECISION,
    "literacy" DOUBLE PRECISION,
    "healthAccess" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarangayMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Point" (
    "id" TEXT NOT NULL,
    "pointID" TEXT NOT NULL,
    "barangayID" TEXT NOT NULL,
    "pointName" TEXT NOT NULL,
    "infrastructure" TEXT,
    "coordinates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointMetrics" (
    "id" TEXT NOT NULL,
    "pointID" TEXT NOT NULL,
    "NDVI" DOUBLE PRECISION,
    "LST" DOUBLE PRECISION,
    "GI" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreenerIndex" (
    "id" TEXT NOT NULL,
    "giID" TEXT NOT NULL,
    "barangayID" TEXT NOT NULL,
    "GI1_Quantity" DOUBLE PRECISION NOT NULL,
    "GI2_Equity" DOUBLE PRECISION NOT NULL,
    "GI3_Resilience" DOUBLE PRECISION NOT NULL,
    "GI4_Connectivity" DOUBLE PRECISION NOT NULL,
    "giValue" DOUBLE PRECISION NOT NULL,
    "giLevel" TEXT NOT NULL,
    "quantityScore" DOUBLE PRECISION,
    "equityScore" DOUBLE PRECISION,
    "resilienceScore" DOUBLE PRECISION,
    "connectivityScore" DOUBLE PRECISION,
    "environmentalScore" DOUBLE PRECISION,
    "accessibilityScore" DOUBLE PRECISION,
    "weights" JSONB NOT NULL,
    "computeStatus" TEXT NOT NULL DEFAULT 'pending',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GreenerIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreeningRecommendation" (
    "id" TEXT NOT NULL,
    "recommendationID" TEXT NOT NULL,
    "areaID" TEXT,
    "cityID" TEXT,
    "barangayID" TEXT,
    "pointID" TEXT,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "interventionType" TEXT NOT NULL,
    "relevancy" DOUBLE PRECISION NOT NULL,
    "efficiency" DOUBLE PRECISION,
    "equipmentNeeded" TEXT,
    "cost" DOUBLE PRECISION,
    "costUnit" TEXT,
    "equity" DOUBLE PRECISION,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "hasBudget" BOOLEAN NOT NULL DEFAULT false,
    "implementationOptions" JSONB,
    "monitoringMetrics" JSONB,
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "recordedOutcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreeningRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricData" (
    "id" TEXT NOT NULL,
    "metricID" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "metricUnit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dataSet" TEXT,
    "dateRecorded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapLayer" (
    "id" TEXT NOT NULL,
    "mapID" TEXT NOT NULL,
    "mapType" TEXT NOT NULL,
    "mapName" TEXT NOT NULL,
    "mapLink" TEXT,
    "toggleVisibility" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "dataSetID" TEXT NOT NULL,
    "dataSetName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSource" TEXT NOT NULL,
    "recordCount" INTEGER,
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoPhoto" (
    "id" TEXT NOT NULL,
    "photoID" TEXT NOT NULL,
    "residentID" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "imageFile" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "barangayID" TEXT,
    "description" TEXT,
    "tags" TEXT[],
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploader" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HazardExposure" (
    "id" TEXT NOT NULL,
    "barangayID" TEXT NOT NULL,
    "hazardType" TEXT NOT NULL,
    "exposureLevel" INTEGER,
    "exposureScore" DOUBLE PRECISION,
    "affectedPopulation" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardExposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "userID" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceID" TEXT,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Administrator_adminID_key" ON "Administrator"("adminID");

-- CreateIndex
CREATE UNIQUE INDEX "Administrator_userID_key" ON "Administrator"("userID");

-- CreateIndex
CREATE INDEX "Administrator_userID_idx" ON "Administrator"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "CityPlanner_plannerID_key" ON "CityPlanner"("plannerID");

-- CreateIndex
CREATE UNIQUE INDEX "CityPlanner_userID_key" ON "CityPlanner"("userID");

-- CreateIndex
CREATE INDEX "CityPlanner_userID_idx" ON "CityPlanner"("userID");

-- CreateIndex
CREATE INDEX "CityPlanner_city_idx" ON "CityPlanner"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Resident_residentID_key" ON "Resident"("residentID");

-- CreateIndex
CREATE UNIQUE INDEX "Resident_userID_key" ON "Resident"("userID");

-- CreateIndex
CREATE INDEX "Resident_userID_idx" ON "Resident"("userID");

-- CreateIndex
CREATE INDEX "Resident_city_idx" ON "Resident"("city");

-- CreateIndex
CREATE INDEX "Resident_barangay_idx" ON "Resident"("barangay");

-- CreateIndex
CREATE UNIQUE INDEX "City_cityID_key" ON "City"("cityID");

-- CreateIndex
CREATE INDEX "City_cityName_idx" ON "City"("cityName");

-- CreateIndex
CREATE UNIQUE INDEX "CityMetrics_cityID_key" ON "CityMetrics"("cityID");

-- CreateIndex
CREATE INDEX "CityMetrics_cityID_idx" ON "CityMetrics"("cityID");

-- CreateIndex
CREATE UNIQUE INDEX "Barangay_barangayID_key" ON "Barangay"("barangayID");

-- CreateIndex
CREATE INDEX "Barangay_cityID_idx" ON "Barangay"("cityID");

-- CreateIndex
CREATE INDEX "Barangay_barangayName_idx" ON "Barangay"("barangayName");

-- CreateIndex
CREATE UNIQUE INDEX "BarangayMetrics_barangayID_key" ON "BarangayMetrics"("barangayID");

-- CreateIndex
CREATE INDEX "BarangayMetrics_barangayID_idx" ON "BarangayMetrics"("barangayID");

-- CreateIndex
CREATE UNIQUE INDEX "Point_pointID_key" ON "Point"("pointID");

-- CreateIndex
CREATE INDEX "Point_barangayID_idx" ON "Point"("barangayID");

-- CreateIndex
CREATE UNIQUE INDEX "PointMetrics_pointID_key" ON "PointMetrics"("pointID");

-- CreateIndex
CREATE INDEX "PointMetrics_pointID_idx" ON "PointMetrics"("pointID");

-- CreateIndex
CREATE UNIQUE INDEX "GreenerIndex_giID_key" ON "GreenerIndex"("giID");

-- CreateIndex
CREATE UNIQUE INDEX "GreenerIndex_barangayID_key" ON "GreenerIndex"("barangayID");

-- CreateIndex
CREATE INDEX "GreenerIndex_barangayID_idx" ON "GreenerIndex"("barangayID");

-- CreateIndex
CREATE INDEX "GreenerIndex_giLevel_idx" ON "GreenerIndex"("giLevel");

-- CreateIndex
CREATE UNIQUE INDEX "GreeningRecommendation_recommendationID_key" ON "GreeningRecommendation"("recommendationID");

-- CreateIndex
CREATE INDEX "GreeningRecommendation_cityID_idx" ON "GreeningRecommendation"("cityID");

-- CreateIndex
CREATE INDEX "GreeningRecommendation_barangayID_idx" ON "GreeningRecommendation"("barangayID");

-- CreateIndex
CREATE INDEX "GreeningRecommendation_pointID_idx" ON "GreeningRecommendation"("pointID");

-- CreateIndex
CREATE INDEX "GreeningRecommendation_status_idx" ON "GreeningRecommendation"("status");

-- CreateIndex
CREATE INDEX "GreeningRecommendation_priority_idx" ON "GreeningRecommendation"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "MetricData_metricID_key" ON "MetricData"("metricID");

-- CreateIndex
CREATE INDEX "MetricData_metricType_idx" ON "MetricData"("metricType");

-- CreateIndex
CREATE INDEX "MetricData_dateRecorded_idx" ON "MetricData"("dateRecorded");

-- CreateIndex
CREATE UNIQUE INDEX "MapLayer_mapID_key" ON "MapLayer"("mapID");

-- CreateIndex
CREATE INDEX "MapLayer_mapType_idx" ON "MapLayer"("mapType");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_dataSetID_key" ON "Dataset"("dataSetID");

-- CreateIndex
CREATE INDEX "Dataset_dataType_idx" ON "Dataset"("dataType");

-- CreateIndex
CREATE UNIQUE INDEX "GeoPhoto_photoID_key" ON "GeoPhoto"("photoID");

-- CreateIndex
CREATE INDEX "GeoPhoto_residentID_idx" ON "GeoPhoto"("residentID");

-- CreateIndex
CREATE INDEX "GeoPhoto_uploadDate_idx" ON "GeoPhoto"("uploadDate");

-- CreateIndex
CREATE INDEX "HazardExposure_barangayID_idx" ON "HazardExposure"("barangayID");

-- CreateIndex
CREATE INDEX "HazardExposure_hazardType_idx" ON "HazardExposure"("hazardType");

-- CreateIndex
CREATE UNIQUE INDEX "HazardExposure_barangayID_hazardType_key" ON "HazardExposure"("barangayID", "hazardType");

-- CreateIndex
CREATE INDEX "SystemLog_userID_idx" ON "SystemLog"("userID");

-- CreateIndex
CREATE INDEX "SystemLog_action_idx" ON "SystemLog"("action");

-- CreateIndex
CREATE INDEX "SystemLog_timestamp_idx" ON "SystemLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Administrator" ADD CONSTRAINT "Administrator_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityPlanner" ADD CONSTRAINT "CityPlanner_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resident" ADD CONSTRAINT "Resident_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMetrics" ADD CONSTRAINT "CityMetrics_cityID_fkey" FOREIGN KEY ("cityID") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barangay" ADD CONSTRAINT "Barangay_cityID_fkey" FOREIGN KEY ("cityID") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarangayMetrics" ADD CONSTRAINT "BarangayMetrics_barangayID_fkey" FOREIGN KEY ("barangayID") REFERENCES "Barangay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Point" ADD CONSTRAINT "Point_barangayID_fkey" FOREIGN KEY ("barangayID") REFERENCES "Barangay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointMetrics" ADD CONSTRAINT "PointMetrics_pointID_fkey" FOREIGN KEY ("pointID") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreenerIndex" ADD CONSTRAINT "GreenerIndex_barangayID_fkey" FOREIGN KEY ("barangayID") REFERENCES "Barangay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreeningRecommendation" ADD CONSTRAINT "GreeningRecommendation_cityID_fkey" FOREIGN KEY ("cityID") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreeningRecommendation" ADD CONSTRAINT "GreeningRecommendation_barangayID_fkey" FOREIGN KEY ("barangayID") REFERENCES "Barangay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreeningRecommendation" ADD CONSTRAINT "GreeningRecommendation_pointID_fkey" FOREIGN KEY ("pointID") REFERENCES "Point"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoPhoto" ADD CONSTRAINT "GeoPhoto_residentID_fkey" FOREIGN KEY ("residentID") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazardExposure" ADD CONSTRAINT "HazardExposure_barangayID_fkey" FOREIGN KEY ("barangayID") REFERENCES "Barangay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
