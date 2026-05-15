-- Run this in your Supabase SQL editor before using Team Members feature
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'DBA' CHECK (role IN ('Admin', 'DBA', 'NOC')),
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow authenticated users to read profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON user_profiles FOR SELECT TO authenticated USING (true);

-- Allow service role to manage profiles (used by admin API routes)
-- The service role bypasses RLS automatically, no policy needed.
