-- Table: chatbot_conversations
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.chatbot_conversations (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  phone TEXT NOT NULL,
  patient_id UUID,
  state TEXT DEFAULT 'IDLE',
  context JSONB DEFAULT '{}',
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  client_id UUID,
  last_message_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.chatbot_conversations ADD CONSTRAINT chatbot_conversations_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.chatbot_conversations ADD CONSTRAINT chatbot_conversations_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.chatbot_conversations ADD CONSTRAINT chatbot_conversations_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

CREATE INDEX idx_chatbot_conversations_phone ON public.chatbot_conversations USING btree (phone);

CREATE INDEX idx_chatbot_conversations_tenant ON public.chatbot_conversations USING btree (tenant_id);
