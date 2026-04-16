-- Table: odontogram_tooth_history
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.odontogram_tooth_history (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  odontogram_id UUID NOT NULL,
  tooth_number INTEGER NOT NULL,
  previous_condition TEXT,
  new_condition TEXT NOT NULL,
  previous_surfaces TEXT,
  new_surfaces TEXT,
  previous_notes TEXT,
  new_notes TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  change_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.odontogram_tooth_history ADD CONSTRAINT odontogram_tooth_history_odontogram_id_fkey
  FOREIGN KEY (odontogram_id) REFERENCES public.odontograms(id);

ALTER TABLE public.odontogram_tooth_history ADD CONSTRAINT odontogram_tooth_history_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id);
