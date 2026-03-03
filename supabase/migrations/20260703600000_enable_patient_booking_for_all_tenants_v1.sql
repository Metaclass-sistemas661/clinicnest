-- ============================================================================
-- Migration: 20260703600000_enable_patient_booking_for_all_tenants_v1
-- Description: Enable patient portal booking (patient_booking_enabled) for all
--   existing tenants. The column was created with DEFAULT false in migration
--   20260326000000 but no admin UI exists to toggle it, so all clinics show
--   "Agendamento Online Indisponível" in the patient portal.
-- ============================================================================

UPDATE public.tenants
SET patient_booking_enabled = true
WHERE patient_booking_enabled = false;

-- Also set a sane default for new tenants going forward
ALTER TABLE public.tenants
  ALTER COLUMN patient_booking_enabled SET DEFAULT true;
