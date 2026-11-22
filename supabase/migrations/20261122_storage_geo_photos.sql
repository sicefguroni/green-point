-- Private bucket for map / site photos uploaded through /api/geophotos/analyze.
-- Before this bucket existed, the route fell back to `identity-documents`, so site
-- photos were stored next to residents' ID scans. Apply via Supabase CLI or the SQL editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'geo-photos',
  'geo-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "geo_photos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "geo_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "geo_photos_delete_own" ON storage.objects;

-- Objects are written as `<auth.uid()>/<timestamp>-<file>` (geoPhotoObjectPath).
CREATE POLICY "geo_photos_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'geo-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "geo_photos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'geo-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "geo_photos_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'geo-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
