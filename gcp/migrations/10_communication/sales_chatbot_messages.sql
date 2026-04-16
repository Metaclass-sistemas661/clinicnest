-- Table: sales_chatbot_messages
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sales_chatbot_messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  conversation_id UUID NOT NULL,
  direction TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.sales_chatbot_messages ADD CONSTRAINT sales_chatbot_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.sales_chatbot_conversations(id);
