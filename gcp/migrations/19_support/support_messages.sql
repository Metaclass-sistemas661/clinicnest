-- Table: support_messages
-- Domain: 19_support
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  ticket_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id);

CREATE INDEX support_messages_ticket_id_idx ON public.support_messages USING btree (ticket_id, created_at);
