-- Table: campaign_deliveries
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.campaign_deliveries (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  campaign_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  email TEXT,
  status TEXT DEFAULT 'sent',
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  client_id UUID NOT NULL,
  error TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  to_email TEXT NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);

ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

CREATE INDEX idx_campaign_deliveries_campaign ON public.campaign_deliveries USING btree (campaign_id, created_at DESC);

CREATE INDEX idx_campaign_deliveries_campaign_status ON public.campaign_deliveries USING btree (campaign_id, status, created_at DESC);
