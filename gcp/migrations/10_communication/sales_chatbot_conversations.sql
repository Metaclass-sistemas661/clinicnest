-- Table: sales_chatbot_conversations
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sales_chatbot_conversations (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  phone TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_clinic_size INTEGER,
  context JSONB DEFAULT '{}' NOT NULL,
  is_human_takeover BOOLEAN DEFAULT false NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.sales_chatbot_conversations ADD CONSTRAINT sales_chatbot_conversations_phone_key UNIQUE (phone);
