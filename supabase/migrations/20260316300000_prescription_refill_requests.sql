-- ═══════════════════════════════════════════════════════════════════════════════
-- FASE 6B — Pedidos de Renovação de Receita
--
-- Paciente solicita refill pelo portal → profissional aprova ou rejeita.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prescription_refill_requests (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescription_id  uuid,               -- referência à receita original (opcional)
  medication_name  text NOT NULL,       -- nome do medicamento solicitado
  reason           text,                -- motivo do pedido
  status           text NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'scheduled'
  reviewer_id      uuid REFERENCES auth.users(id),   -- profissional que revisou
  reviewer_notes   text,                -- notas do profissional
  reviewed_at      timestamptz,
  created_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_refill_status CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled'))
);

-- RLS
ALTER TABLE public.prescription_refill_requests ENABLE ROW LEVEL SECURITY;

-- Profissionais do tenant leem e atualizam
CREATE POLICY "Profissionais gerenciam refills do tenant" ON public.prescription_refill_requests
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Pacientes inserem e leem seus próprios pedidos
CREATE POLICY "Pacientes inserem refills" ON public.prescription_refill_requests
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

CREATE POLICY "Pacientes leem seus refills" ON public.prescription_refill_requests
  FOR SELECT USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_refill_patient ON public.prescription_refill_requests(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refill_tenant_status ON public.prescription_refill_requests(tenant_id, status) WHERE status = 'pending';

COMMENT ON TABLE public.prescription_refill_requests IS 'Pedidos de renovação de receita feitos pelo paciente via portal. Fase 6B.';
