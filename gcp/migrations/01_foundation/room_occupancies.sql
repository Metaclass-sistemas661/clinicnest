-- Table: room_occupancies
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.room_occupancies (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  room_id UUID NOT NULL,
  appointment_id UUID,
  professional_id UUID,
  client_name TEXT,
  status TEXT DEFAULT 'occupied' NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.room_occupancies ADD CONSTRAINT room_occupancies_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.room_occupancies ADD CONSTRAINT room_occupancies_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES public.clinic_rooms(id);

ALTER TABLE public.room_occupancies ADD CONSTRAINT room_occupancies_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.room_occupancies ADD CONSTRAINT room_occupancies_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);
