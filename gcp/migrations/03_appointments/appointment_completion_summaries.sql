-- Table: appointment_completion_summaries
-- Domain: 03_appointments
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.appointment_completion_summaries (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  professional_name TEXT,
  service_name TEXT,
  service_profit NUMERIC DEFAULT 0,
  product_sales JSONB DEFAULT '[]',
  product_profit_total NUMERIC DEFAULT 0,
  total_profit NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.appointment_completion_summaries ADD CONSTRAINT appointment_completion_summaries_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.appointment_completion_summaries ADD CONSTRAINT appointment_completion_summaries_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE UNIQUE INDEX appointment_completion_summaries_appointment_id_unique ON public.appointment_completion_summaries USING btree (appointment_id) WHERE (appointment_id IS NOT NULL);

CREATE INDEX idx_appointment_completion_summaries_created ON public.appointment_completion_summaries USING btree (created_at);

CREATE INDEX idx_appointment_completion_summaries_tenant ON public.appointment_completion_summaries USING btree (tenant_id);
