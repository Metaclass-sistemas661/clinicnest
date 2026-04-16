-- Table: user_video_progress
-- Domain: 20_user_preferences
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.user_video_progress (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  video_id UUID NOT NULL,
  watched_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.user_video_progress ADD CONSTRAINT user_video_progress_user_id_video_id_key UNIQUE (user_id, video_id);

ALTER TABLE public.user_video_progress ADD CONSTRAINT user_video_progress_video_id_fkey
  FOREIGN KEY (video_id) REFERENCES public.video_tutorials(id);
