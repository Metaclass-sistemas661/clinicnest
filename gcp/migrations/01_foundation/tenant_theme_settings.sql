-- Table: tenant_theme_settings
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tenant_theme_settings (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  primary_h INTEGER DEFAULT 174,
  primary_s INTEGER DEFAULT 72,
  primary_l INTEGER DEFAULT 38,
  accent_h INTEGER DEFAULT 210,
  accent_s INTEGER DEFAULT 80,
  accent_l INTEGER DEFAULT 55,
  preset_name TEXT DEFAULT 'teal',
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  border_radius TEXT DEFAULT '1rem',
  font_family TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.tenant_theme_settings ADD CONSTRAINT tenant_theme_settings_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.tenant_theme_settings ADD CONSTRAINT tenant_theme_settings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
