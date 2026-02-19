-- Phase 2.4: Asaas PIX integration — add asaas_api_key to tenants
-- Also adds asaas_environment to allow sandbox/production toggle

alter table public.tenants
  add column if not exists asaas_api_key text,
  add column if not exists asaas_environment text default 'sandbox';
