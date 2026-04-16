-- Table: chatbot_messages
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  message_type TEXT DEFAULT 'text' NOT NULL,
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (id)
);

ALTER TABLE public.chatbot_messages ADD CONSTRAINT chatbot_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.chatbot_conversations(id);

ALTER TABLE public.chatbot_messages ADD CONSTRAINT chatbot_messages_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
