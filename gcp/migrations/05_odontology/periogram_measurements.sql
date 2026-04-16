-- Table: periogram_measurements
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.periogram_measurements (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  periogram_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER NOT NULL,
  site TEXT NOT NULL,
  probing_depth INTEGER,
  gingival_margin INTEGER,
  bleeding BOOLEAN DEFAULT false,
  plaque BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.periogram_measurements ADD CONSTRAINT periogram_measurements_periogram_id_fkey
  FOREIGN KEY (periogram_id) REFERENCES public.periograms(id);

ALTER TABLE public.periogram_measurements ADD CONSTRAINT periogram_measurements_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
