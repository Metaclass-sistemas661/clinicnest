-- Migration: Add Meta WhatsApp Cloud API columns to tenants
-- Replaces the old evolution-api columns (whatsapp_api_url, whatsapp_api_key, whatsapp_instance)
-- The old columns are kept for backward compatibility during transition but are no longer used.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT;
