-- Migration: Add enabled_modules JSONB column to tenants
-- Stores the array of module keys the admin has toggled on

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT NULL;

COMMENT ON COLUMN public.tenants.enabled_modules IS
  'Array of module keys enabled by the admin. NULL = all available modules active (default).';
