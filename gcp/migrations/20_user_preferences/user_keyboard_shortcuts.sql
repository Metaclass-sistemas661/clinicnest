-- Table: user_keyboard_shortcuts
-- Domain: 20_user_preferences
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.user_keyboard_shortcuts (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  action_id TEXT NOT NULL,
  keys TEXT[] NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.user_keyboard_shortcuts ADD CONSTRAINT user_keyboard_shortcuts_user_id_action_id_key UNIQUE (user_id, action_id);
