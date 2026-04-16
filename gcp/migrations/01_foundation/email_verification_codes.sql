-- Table: email_verification_codes
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  verified BOOLEAN DEFAULT false NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
