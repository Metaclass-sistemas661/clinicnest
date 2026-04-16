-- Table: odontogram_teeth
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.odontogram_teeth (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  odontogram_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER NOT NULL,
  status TEXT DEFAULT 'healthy',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.odontogram_teeth ADD CONSTRAINT odontogram_teeth_odontogram_id_fkey
  FOREIGN KEY (odontogram_id) REFERENCES public.odontograms(id);

ALTER TABLE public.odontogram_teeth ADD CONSTRAINT odontogram_teeth_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_odontogram_teeth_odontogram ON public.odontogram_teeth USING btree (odontogram_id);
