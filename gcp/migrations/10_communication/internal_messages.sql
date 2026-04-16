-- Table: internal_messages
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.internal_messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  channel TEXT DEFAULT 'general' NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB,
  reply_to UUID,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  mentions UUID[] DEFAULT '{}',
  PRIMARY KEY (id)
);

ALTER TABLE public.internal_messages ADD CONSTRAINT internal_messages_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_internal_messages_channel ON public.internal_messages USING btree (channel);

CREATE INDEX idx_internal_messages_tenant ON public.internal_messages USING btree (tenant_id);
