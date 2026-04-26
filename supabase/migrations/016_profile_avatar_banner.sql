-- 016_profile_avatar_banner.sql
-- Adds avatar_id + banner_url to users (cross-device sync) and creates
-- the profile-banners storage bucket with RLS.
--
-- Apply via Supabase SQL Editor.

-- 1. Columns on public.users -------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_id text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS banner_url text;

COMMENT ON COLUMN public.users.avatar_id IS
  'Avatar identifier: preset id (e.g. av1) or full URL (Supabase Storage avatars/...).';
COMMENT ON COLUMN public.users.banner_url IS
  'Profile banner: preset:<id> for built-in backgrounds or full URL for uploaded image.';

-- 2. Storage bucket ----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-banners', 'profile-banners', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies --------------------------------------------------------
-- Public read for everyone
DROP POLICY IF EXISTS "Profile banners public read" ON storage.objects;
CREATE POLICY "Profile banners public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-banners');

-- Authenticated users can upload only into their own folder: {auth_id}/...
DROP POLICY IF EXISTS "Profile banners owner insert" ON storage.objects;
CREATE POLICY "Profile banners owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-banners'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update own files
DROP POLICY IF EXISTS "Profile banners owner update" ON storage.objects;
CREATE POLICY "Profile banners owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-banners'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete own files
DROP POLICY IF EXISTS "Profile banners owner delete" ON storage.objects;
CREATE POLICY "Profile banners owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-banners'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
