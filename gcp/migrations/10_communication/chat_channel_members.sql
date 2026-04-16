-- Table: chat_channel_members
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  channel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  profile_id UUID NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id);

ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id);
