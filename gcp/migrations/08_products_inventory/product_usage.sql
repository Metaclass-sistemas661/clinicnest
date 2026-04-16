-- Table: product_usage
-- Domain: 08_products_inventory
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.product_usage (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  quantity NUMERIC DEFAULT 1 NOT NULL,
  unit TEXT DEFAULT 'un' NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  zone TEXT,
  procedure_type TEXT,
  notes TEXT,
  applied_by UUID,
  applied_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.product_usage ADD CONSTRAINT product_usage_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.product_usage ADD CONSTRAINT product_usage_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE public.product_usage ADD CONSTRAINT product_usage_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.product_usage ADD CONSTRAINT product_usage_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.product_usage ADD CONSTRAINT product_usage_applied_by_fkey
  FOREIGN KEY (applied_by) REFERENCES public.profiles(id);

CREATE INDEX idx_product_usage_appointment ON public.product_usage USING btree (appointment_id);

CREATE INDEX idx_product_usage_patient ON public.product_usage USING btree (patient_id);

CREATE INDEX idx_product_usage_product ON public.product_usage USING btree (product_id);

CREATE INDEX idx_product_usage_tenant ON public.product_usage USING btree (tenant_id);
