-- ============================================================
-- MIGRAÇÃO: Vínculo Triagem → Prontuário + Status de Triagem
-- Arquivo: 20260322300000_triage_prontuario_link_v1.sql
-- ============================================================

-- 1. Status na triagem para controlar fila de atendimento
ALTER TABLE public.triage_records
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_atendimento', 'concluida'));

CREATE INDEX IF NOT EXISTS idx_triage_records_status
  ON public.triage_records(tenant_id, status, triaged_at DESC);

-- 2. Vínculo direto triagem → prontuário
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS triage_id UUID REFERENCES public.triage_records(id) ON DELETE SET NULL;

-- 3. Qual modelo/template de prontuário foi usado
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.record_field_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medical_records_triage
  ON public.medical_records(triage_id);

CREATE INDEX IF NOT EXISTS idx_medical_records_template
  ON public.medical_records(template_id);

COMMENT ON COLUMN public.triage_records.status IS 'pendente=aguardando médico, em_atendimento=médico preenchendo prontuário, concluida=prontuário salvo';
COMMENT ON COLUMN public.medical_records.triage_id IS 'Triagem vinculada a este prontuário (mesma visita)';
COMMENT ON COLUMN public.medical_records.template_id IS 'Modelo de prontuário utilizado (campos dinâmicos)';
