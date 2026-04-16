-- Table: dental_images
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.dental_images (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  image_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  tooth_number INTEGER,
  notes TEXT,
  taken_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.dental_images ADD CONSTRAINT dental_images_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.dental_images ADD CONSTRAINT dental_images_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_dental_images_patient ON public.dental_images USING btree (patient_id);
