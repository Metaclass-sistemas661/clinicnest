-- Table: offline_cache_metadata
-- Domain: 20_user_preferences
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.offline_cache_metadata (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  data_type TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  sync_version INTEGER DEFAULT 1,
  size_bytes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.offline_cache_metadata ADD CONSTRAINT offline_cache_metadata_user_id_cache_key_key UNIQUE (user_id, cache_key);

ALTER TABLE public.offline_cache_metadata ADD CONSTRAINT offline_cache_metadata_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
