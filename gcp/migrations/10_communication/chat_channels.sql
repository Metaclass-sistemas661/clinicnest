-- Table: chat_channels
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
