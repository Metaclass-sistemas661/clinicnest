-- Table: odontogram_tooth_surfaces
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.odontogram_tooth_surfaces (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tooth_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  surface TEXT NOT NULL,
  condition TEXT DEFAULT 'healthy',
  procedure_done TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.odontogram_tooth_surfaces ADD CONSTRAINT odontogram_tooth_surfaces_tooth_id_fkey
  FOREIGN KEY (tooth_id) REFERENCES public.odontogram_teeth(id);

ALTER TABLE public.odontogram_tooth_surfaces ADD CONSTRAINT odontogram_tooth_surfaces_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
