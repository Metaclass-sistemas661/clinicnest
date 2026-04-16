-- Table: contact_messages
-- Domain: 19_support
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX idx_contact_messages_email_created ON public.contact_messages USING btree (email, created_at DESC);
