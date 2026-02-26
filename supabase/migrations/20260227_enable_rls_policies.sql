-- Enable Row Level Security (RLS) on all tables
-- This migration sets up comprehensive RLS policies for the GreenPoint system

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Administrator" WHERE "userID" = user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is a city planner
CREATE OR REPLACE FUNCTION is_city_planner(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM "CityPlanner" WHERE "userID" = user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is a resident
CREATE OR REPLACE FUNCTION is_resident(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Resident" WHERE "userID" = user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get user's role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT "role"::TEXT FROM "User" WHERE id = user_id
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get city planner's assigned city
CREATE OR REPLACE FUNCTION get_planner_city(user_id UUID)
RETURNS UUID AS $$
  SELECT "city" FROM "CityPlanner" WHERE "userID" = user_id LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get resident's barangay
CREATE OR REPLACE FUNCTION get_resident_barangay(user_id UUID)
RETURNS STRING AS $$
  SELECT "barangay" FROM "Resident" WHERE "userID" = user_id LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- USER TABLE RLS
-- ============================================================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Admin can see all users
CREATE POLICY admin_all_users ON "User"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Users can only view/edit their own profile
CREATE POLICY user_own_profile ON "User"
  AS PERMISSIVE
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY user_update_own_profile ON "User"
  AS PERMISSIVE
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- City planners can view all users in their city
CREATE POLICY planner_view_city_users ON "User"
  AS PERMISSIVE
  FOR SELECT
  USING (
    is_city_planner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM "Resident" r
      WHERE r."userID" = "User".id
      AND r.city = (SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid())
    )
  );

-- ============================================================================
-- ADMINISTRATOR TABLE RLS
-- ============================================================================

ALTER TABLE "Administrator" ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_view_all_admins ON "Administrator"
  AS PERMISSIVE
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY admin_manage_admins ON "Administrator"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- CITY PLANNER TABLE RLS
-- ============================================================================

ALTER TABLE "CityPlanner" ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_view_all_planners ON "CityPlanner"
  AS PERMISSIVE
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY planner_view_own_profile ON "CityPlanner"
  AS PERMISSIVE
  FOR SELECT
  USING ("userID" = auth.uid());

CREATE POLICY admin_manage_planners ON "CityPlanner"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- RESIDENT TABLE RLS
-- ============================================================================

ALTER TABLE "Resident" ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_view_all_residents ON "Resident"
  AS PERMISSIVE
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY resident_view_own_profile ON "Resident"
  AS PERMISSIVE
  FOR SELECT
  USING ("userID" = auth.uid());

CREATE POLICY resident_update_own_profile ON "Resident"
  AS PERMISSIVE
  FOR UPDATE
  USING ("userID" = auth.uid())
  WITH CHECK ("userID" = auth.uid());

CREATE POLICY planner_view_city_residents ON "Resident"
  AS PERMISSIVE
  FOR SELECT
  USING (
    is_city_planner(auth.uid())
    AND city = (SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid())
  );

CREATE POLICY admin_manage_residents ON "Resident"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- CITY TABLE RLS
-- ============================================================================

ALTER TABLE "City" ENABLE ROW LEVEL SECURITY;

-- Everyone can view cities (public data)
CREATE POLICY anyone_view_cities ON "City"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Only admin can manage cities
CREATE POLICY admin_manage_cities ON "City"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- CITY METRICS TABLE RLS
-- ============================================================================

ALTER TABLE "CityMetrics" ENABLE ROW LEVEL SECURITY;

-- Everyone can view city metrics (public data)
CREATE POLICY anyone_view_city_metrics ON "CityMetrics"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Only admin can manage city metrics
CREATE POLICY admin_manage_city_metrics ON "CityMetrics"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- BARANGAY TABLE RLS
-- ============================================================================

ALTER TABLE "Barangay" ENABLE ROW LEVEL SECURITY;

-- Everyone can view barangays (public data)
CREATE POLICY anyone_view_barangays ON "Barangay"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- City planners can view barangays in their city
CREATE POLICY planner_view_own_city_barangays ON "Barangay"
  AS PERMISSIVE
  FOR SELECT
  USING (true); -- Already limited by city relationship

-- Only admin can manage barangays
CREATE POLICY admin_manage_barangays ON "Barangay"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- BARANGAY METRICS TABLE RLS
-- ============================================================================

ALTER TABLE "BarangayMetrics" ENABLE ROW LEVEL SECURITY;

-- Everyone can view barangay metrics (public data)
CREATE POLICY anyone_view_barangay_metrics ON "BarangayMetrics"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Only admin can manage barangay metrics
CREATE POLICY admin_manage_barangay_metrics ON "BarangayMetrics"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- POINT TABLE RLS
-- ============================================================================

ALTER TABLE "Point" ENABLE ROW LEVEL SECURITY;

-- Everyone can view points (public data)
CREATE POLICY anyone_view_points ON "Point"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- City planners can view points in their city's barangays
CREATE POLICY planner_view_city_points ON "Point"
  AS PERMISSIVE
  FOR SELECT
  USING (
    is_city_planner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM "Barangay" b
      WHERE b.id = "Point"."barangayID"
      AND b."cityID" = (SELECT "cityID" FROM "City" WHERE id = (
        SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
      ))
    )
  );

-- Only admin can manage points
CREATE POLICY admin_manage_points ON "Point"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- POINT METRICS TABLE RLS
-- ============================================================================

ALTER TABLE "PointMetrics" ENABLE ROW LEVEL SECURITY;

-- Everyone can view point metrics (public data)
CREATE POLICY anyone_view_point_metrics ON "PointMetrics"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Only admin can manage point metrics
CREATE POLICY admin_manage_point_metrics ON "PointMetrics"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- GREENERY INDEX TABLE RLS
-- ============================================================================

ALTER TABLE "GreenerIndex" ENABLE ROW LEVEL SECURITY;

-- Everyone can view greenery index (public data)
CREATE POLICY anyone_view_gi ON "GreenerIndex"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- City planners can view GI for their city
CREATE POLICY planner_view_city_gi ON "GreenerIndex"
  AS PERMISSIVE
  FOR SELECT
  USING (
    is_city_planner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM "Barangay" b
      WHERE b.id = "GreenerIndex"."barangayID"
      AND b."cityID" = (SELECT "cityID" FROM "City" WHERE id = (
        SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
      ))
    )
  );

-- Only admin can manage GI
CREATE POLICY admin_manage_gi ON "GreenerIndex"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- GREENING RECOMMENDATION TABLE RLS
-- ============================================================================

ALTER TABLE "GreeningRecommendation" ENABLE ROW LEVEL SECURITY;

-- Everyone can view approved recommendations
CREATE POLICY anyone_view_approved_recommendations ON "GreeningRecommendation"
  AS PERMISSIVE
  FOR SELECT
  USING (status = 'approved' OR status = 'implemented');

-- Residents can view recommendations for their barangay
CREATE POLICY resident_view_barangay_recommendations ON "GreeningRecommendation"
  AS PERMISSIVE
  FOR SELECT
  USING (
    is_resident(auth.uid())
    AND "barangayID" = (SELECT id FROM "Barangay" WHERE "barangayName" = (
      SELECT barangay FROM "Resident" WHERE "userID" = auth.uid()
    ))
  );

-- City planners can view/create recommendations for their city
CREATE POLICY planner_view_manage_recommendations ON "GreeningRecommendation"
  AS PERMISSIVE
  FOR ALL
  USING (
    is_city_planner(auth.uid())
    AND (
      "cityID" = (SELECT "cityID" FROM "City" WHERE id = (
        SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
      ))
      OR "barangayID" IN (
        SELECT id FROM "Barangay" WHERE "cityID" = (
          SELECT "cityID" FROM "City" WHERE id = (
            SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
          )
        )
      )
    )
  )
  WITH CHECK (
    is_city_planner(auth.uid())
    AND (
      "cityID" = (SELECT "cityID" FROM "City" WHERE id = (
        SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
      ))
      OR "barangayID" IN (
        SELECT id FROM "Barangay" WHERE "cityID" = (
          SELECT "cityID" FROM "City" WHERE id = (
            SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
          )
        )
      )
    )
  );

-- Admin can do everything
CREATE POLICY admin_manage_recommendations ON "GreeningRecommendation"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- METRIC DATA TABLE RLS
-- ============================================================================

ALTER TABLE "MetricData" ENABLE ROW LEVEL SECURITY;

-- Everyone can view metric data (public)
CREATE POLICY anyone_view_metric_data ON "MetricData"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Only admin can manage metric data
CREATE POLICY admin_manage_metric_data ON "MetricData"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- MAP LAYER TABLE RLS
-- ============================================================================

ALTER TABLE "MapLayer" ENABLE ROW LEVEL SECURITY;

-- Everyone can view map layers
CREATE POLICY anyone_view_map_layers ON "MapLayer"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Only admin can manage map layers
CREATE POLICY admin_manage_map_layers ON "MapLayer"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- DATASET TABLE RLS
-- ============================================================================

ALTER TABLE "Dataset" ENABLE ROW LEVEL SECURITY;

-- Everyone can view datasets (metadata)
CREATE POLICY anyone_view_datasets ON "Dataset"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Only admin can manage datasets
CREATE POLICY admin_manage_datasets ON "Dataset"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- GEO PHOTO TABLE RLS
-- ============================================================================

ALTER TABLE "GeoPhoto" ENABLE ROW LEVEL SECURITY;

-- Everyone can view geo photos (public contributions)
CREATE POLICY anyone_view_geo_photos ON "GeoPhoto"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- Residents can upload photos
CREATE POLICY resident_upload_photos ON "GeoPhoto"
  AS PERMISSIVE
  FOR INSERT
  USING (is_resident(auth.uid()))
  WITH CHECK ("residentID" = (SELECT id FROM "Resident" WHERE "userID" = auth.uid()));

-- Residents can edit/delete their own photos
CREATE POLICY resident_manage_own_photos ON "GeoPhoto"
  AS PERMISSIVE
  FOR UPDATE
  USING ("residentID" = (SELECT id FROM "Resident" WHERE "userID" = auth.uid()))
  WITH CHECK ("residentID" = (SELECT id FROM "Resident" WHERE "userID" = auth.uid()));

CREATE POLICY resident_delete_own_photos ON "GeoPhoto"
  AS PERMISSIVE
  FOR DELETE
  USING ("residentID" = (SELECT id FROM "Resident" WHERE "userID" = auth.uid()));

-- City planners can view all photos in their city
CREATE POLICY planner_view_city_photos ON "GeoPhoto"
  AS PERMISSIVE
  FOR SELECT
  USING (
    is_city_planner(auth.uid())
    AND "barangayID" IN (
      SELECT id FROM "Barangay" WHERE "cityID" = (
        SELECT "cityID" FROM "City" WHERE id = (
          SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
        )
      )
    )
  );

-- Admin can manage all photos
CREATE POLICY admin_manage_geo_photos ON "GeoPhoto"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- HAZARD EXPOSURE TABLE RLS
-- ============================================================================

ALTER TABLE "HazardExposure" ENABLE ROW LEVEL SECURITY;

-- Everyone can view hazard exposure (public safety data)
CREATE POLICY anyone_view_hazard_exposure ON "HazardExposure"
  AS PERMISSIVE
  FOR SELECT
  USING (true);

-- City planners can view hazards for their city
CREATE POLICY planner_view_city_hazards ON "HazardExposure"
  AS PERMISSIVE
  FOR SELECT
  USING (
    is_city_planner(auth.uid())
    AND "barangayID" IN (
      SELECT id FROM "Barangay" WHERE "cityID" = (
        SELECT "cityID" FROM "City" WHERE id = (
          SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
        )
      )
    )
  );

-- Only admin can manage hazard exposure
CREATE POLICY admin_manage_hazard_exposure ON "HazardExposure"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- SYSTEM LOG TABLE RLS
-- ============================================================================

ALTER TABLE "SystemLog" ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY user_view_own_logs ON "SystemLog"
  AS PERMISSIVE
  FOR SELECT
  USING ("userID" = auth.uid());

-- Admin can view all logs
CREATE POLICY admin_view_all_logs ON "SystemLog"
  AS PERMISSIVE
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Only admin can manage logs
CREATE POLICY admin_manage_logs ON "SystemLog"
  AS PERMISSIVE
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Automatically log actions
CREATE OR REPLACE FUNCTION log_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "SystemLog" ("userID", action, resource, "resourceID", status, timestamp)
  VALUES (
    auth.uid(),
    TG_ARGV[0],
    TG_TABLE_NAME,
    NEW.id::TEXT,
    'success',
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Ensure RLS is properly enforced
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Administrator" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CityPlanner" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Resident" FORCE ROW LEVEL SECURITY;
ALTER TABLE "City" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CityMetrics" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Barangay" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BarangayMetrics" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Point" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PointMetrics" FORCE ROW LEVEL SECURITY;
ALTER TABLE "GreenerIndex" FORCE ROW LEVEL SECURITY;
ALTER TABLE "GreeningRecommendation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MetricData" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MapLayer" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Dataset" FORCE ROW LEVEL SECURITY;
ALTER TABLE "GeoPhoto" FORCE ROW LEVEL SECURITY;
ALTER TABLE "HazardExposure" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SystemLog" FORCE ROW LEVEL SECURITY;
