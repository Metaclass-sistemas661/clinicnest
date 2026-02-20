-- Stone card machine settings on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stone_api_key TEXT,
  ADD COLUMN IF NOT EXISTS stone_terminal_serial TEXT,
  ADD COLUMN IF NOT EXISTS stone_active BOOLEAN DEFAULT false;
