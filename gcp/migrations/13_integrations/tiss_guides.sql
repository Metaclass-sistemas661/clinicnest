-- Table: tiss_guides
-- Domain: uncategorized
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tiss_guides (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  insurance_plan_id UUID,
  appointment_id UUID,
  lot_number TEXT NOT NULL,
  guide_number TEXT NOT NULL,
  guide_type TEXT DEFAULT 'consulta' NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  xml_content TEXT,
  tiss_version TEXT DEFAULT '3.05.00' NOT NULL,
  submitted_at TIMESTAMPTZ,
  response_code TEXT,
  response_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  glosa_code TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.tiss_guides ADD CONSTRAINT tiss_guides_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.tiss_guides ADD CONSTRAINT tiss_guides_insurance_plan_id_fkey
  FOREIGN KEY (insurance_plan_id) REFERENCES public.insurance_plans(id);

ALTER TABLE public.tiss_guides ADD CONSTRAINT tiss_guides_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);
