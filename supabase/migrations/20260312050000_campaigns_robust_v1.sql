-- Milestone 6b: Campanhas mais robustas (banner/preheader + envio em lotes)

-- 1) Status 'sending' para permitir envios por lotes sem marcar como sent prematuramente
DO $$
BEGIN
  ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'sending';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Campos extras para compor o email e enriquecer a campanha
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS preheader text;

-- 3) Idempotência: uma entrega por (campanha, cliente)
-- Isso permite reexecutar lotes sem reenviar para o mesmo cliente.
DO $$
BEGIN
  ALTER TABLE public.campaign_deliveries
    ADD CONSTRAINT campaign_deliveries_campaign_client_unique UNIQUE (campaign_id, client_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4) Índice auxiliar para consultas por campanha
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign_status
  ON public.campaign_deliveries (campaign_id, status, created_at DESC);
