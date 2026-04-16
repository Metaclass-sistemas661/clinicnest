-- Table: orders
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  total NUMERIC DEFAULT 0 NOT NULL,
  discount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.orders ADD CONSTRAINT orders_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.orders ADD CONSTRAINT orders_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.orders ADD CONSTRAINT orders_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE INDEX idx_orders_appointment ON public.orders USING btree (appointment_id);

CREATE INDEX idx_orders_tenant_created ON public.orders USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_orders_tenant_id ON public.orders USING btree (tenant_id);

CREATE INDEX idx_orders_tenant_status ON public.orders USING btree (tenant_id, status);
