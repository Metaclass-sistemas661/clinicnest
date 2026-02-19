-- Fase 0: Link de confirmação de agendamento online
-- Adiciona confirmed_at e source em appointments

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal'
    CHECK (source IN ('internal', 'online', 'whatsapp'));

-- Backfill: agendamentos que vieram do booking público já têm public_booking_token
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'public_booking_token'
  ) THEN
    UPDATE public.appointments
      SET source = 'online'
      WHERE public_booking_token IS NOT NULL
        AND (source IS NULL OR source = 'internal');
  END IF;
END $$;

-- Índice para consultas por source
CREATE INDEX IF NOT EXISTS idx_appointments_source
  ON public.appointments(tenant_id, source)
  WHERE source = 'online';

COMMENT ON COLUMN public.appointments.confirmed_at IS 'Preenchido quando o cliente clica no link de confirmação enviado por e-mail';
COMMENT ON COLUMN public.appointments.source IS 'Origem do agendamento: internal (admin/staff), online (booking público), whatsapp (futuro)';
