-- Table: clinic_rooms
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.clinic_rooms (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  unit_id UUID,
  name TEXT NOT NULL,
  room_type TEXT DEFAULT 'consultation' NOT NULL,
  capacity INTEGER DEFAULT 1 NOT NULL,
  floor TEXT,
  equipment TEXT[],
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.clinic_rooms ADD CONSTRAINT clinic_rooms_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.clinic_rooms ADD CONSTRAINT clinic_rooms_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.clinic_units(id);
