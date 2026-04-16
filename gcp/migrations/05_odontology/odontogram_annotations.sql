-- Table: odontogram_annotations
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.odontogram_annotations (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  odontogram_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER,
  annotation_type TEXT,
  content TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.odontogram_annotations ADD CONSTRAINT odontogram_annotations_odontogram_id_fkey
  FOREIGN KEY (odontogram_id) REFERENCES public.odontograms(id);

ALTER TABLE public.odontogram_annotations ADD CONSTRAINT odontogram_annotations_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_annotations_odontogram ON public.odontogram_annotations USING btree (odontogram_id);
