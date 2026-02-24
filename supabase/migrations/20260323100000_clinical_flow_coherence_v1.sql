-- ============================================================
-- MIGRAÇÃO: Fase 7 — Coerência de Fluxo Clínico
-- Vincula documentos clínicos ao prontuário/atendimento de origem
-- ============================================================

-- 1. prescriptions: adicionar medical_record_id
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_medical_record ON public.prescriptions(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON public.prescriptions(appointment_id);

-- 2. medical_certificates: adicionar medical_record_id
ALTER TABLE public.medical_certificates
  ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medical_certificates_medical_record ON public.medical_certificates(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_medical_certificates_appointment ON public.medical_certificates(appointment_id);

-- 3. exam_results: adicionar medical_record_id
ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_results_medical_record ON public.exam_results(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_appointment ON public.exam_results(appointment_id);

-- 4. referrals: adicionar appointment_id (medical_record_id já existe)
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_medical_record ON public.referrals(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_referrals_appointment ON public.referrals(appointment_id);

-- 5. nursing_evolutions: adicionar medical_record_id (appointment_id já existe)
ALTER TABLE public.nursing_evolutions
  ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nursing_evo_medical_record ON public.nursing_evolutions(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_nursing_evo_appointment ON public.nursing_evolutions(appointment_id);

-- 6. clients: adicionar campo alergias global (Fase 8.5 — aproveitando a migration)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS allergies TEXT;

COMMENT ON COLUMN public.clients.allergies IS 'Alergias conhecidas — exibido como alerta global em triagem, prontuário e receituário';
