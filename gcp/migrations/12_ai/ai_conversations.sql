-- Table: ai_conversations
-- Domain: 12_ai
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT,
  model TEXT DEFAULT 'gemini-2.0-flash',
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB DEFAULT '{}',
  participant_type TEXT NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.ai_conversations ADD CONSTRAINT ai_conversations_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_ai_conversations_tenant ON public.ai_conversations USING btree (tenant_id);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations USING btree (user_id);
