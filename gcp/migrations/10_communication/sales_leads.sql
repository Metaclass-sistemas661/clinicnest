-- Table: sales_leads
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  phone TEXT,
  email TEXT,
  name TEXT,
  clinic_size INTEGER,
  source TEXT DEFAULT 'whatsapp' NOT NULL,
  status TEXT DEFAULT 'new' NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.sales_leads ADD CONSTRAINT sales_leads_phone_key UNIQUE (phone);
