-- Table: video_tutorials
-- Domain: 20_user_preferences
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.video_tutorials (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  category TEXT NOT NULL,
  feature_key TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);
