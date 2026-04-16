-- Table: ai_conversation_messages
-- Domain: 12_ai
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.ai_conversation_messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  tool_input JSONB,
  tool_name TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.ai_conversation_messages ADD CONSTRAINT ai_conversation_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id);

ALTER TABLE public.ai_conversation_messages ADD CONSTRAINT ai_conversation_messages_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_ai_messages_conversation ON public.ai_conversation_messages USING btree (conversation_id);
