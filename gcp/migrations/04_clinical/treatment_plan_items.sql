-- Table: treatment_plan_items
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.treatment_plan_items (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  plan_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER,
  surface TEXT,
  procedure_name TEXT NOT NULL,
  procedure_code TEXT,
  cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'planned',
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  appointment_id UUID,
  completed_by UUID,
  discount_percent NUMERIC DEFAULT 0,
  notes TEXT,
  odontogram_tooth_id UUID,
  procedure_category TEXT,
  quantity INTEGER DEFAULT 1 NOT NULL,
  region TEXT,
  total_price NUMERIC DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.treatment_plan_items ADD CONSTRAINT treatment_plan_items_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES public.treatment_plans(id);

ALTER TABLE public.treatment_plan_items ADD CONSTRAINT treatment_plan_items_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.treatment_plan_items ADD CONSTRAINT treatment_plan_items_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.treatment_plan_items ADD CONSTRAINT treatment_plan_items_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES public.profiles(id);

ALTER TABLE public.treatment_plan_items ADD CONSTRAINT treatment_plan_items_odontogram_tooth_id_fkey
  FOREIGN KEY (odontogram_tooth_id) REFERENCES public.odontogram_teeth(id);
