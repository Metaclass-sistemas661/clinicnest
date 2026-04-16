-- Table: chat_read_status
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.chat_read_status (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  profile_id UUID NOT NULL,
  channel TEXT NOT NULL,
  channel_id UUID,
  last_read_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_read_message_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.chat_read_status ADD CONSTRAINT chat_read_status_profile_id_channel_id_key UNIQUE (profile_id, channel_id);

ALTER TABLE public.chat_read_status ADD CONSTRAINT chat_read_status_profile_id_channel_key UNIQUE (profile_id, channel);

ALTER TABLE public.chat_read_status ADD CONSTRAINT chat_read_status_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id);

ALTER TABLE public.chat_read_status ADD CONSTRAINT chat_read_status_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id);

ALTER TABLE public.chat_read_status ADD CONSTRAINT chat_read_status_last_read_message_id_fkey
  FOREIGN KEY (last_read_message_id) REFERENCES public.internal_messages(id);
