-- ============================================================
-- MIGRAÇÃO: Assinatura Digital de Prontuários
-- Arquivo: 20260322500000_medical_records_digital_signature_v1.sql
-- Descrição: Adiciona campos para assinatura digital (hash SHA-256),
--   versionamento e rastreabilidade jurídica dos prontuários.
-- ============================================================

-- 1. Campos de assinatura digital no prontuário
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS digital_hash        TEXT,
  ADD COLUMN IF NOT EXISTS signed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_name      TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_crm       TEXT,
  ADD COLUMN IF NOT EXISTS is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lock_reason         TEXT;

COMMENT ON COLUMN public.medical_records.digital_hash   IS 'SHA-256 do conteúdo do prontuário no momento da assinatura';
COMMENT ON COLUMN public.medical_records.signed_at      IS 'Timestamp exato da assinatura digital';
COMMENT ON COLUMN public.medical_records.signed_by_name IS 'Nome completo do profissional que assinou';
COMMENT ON COLUMN public.medical_records.signed_by_crm  IS 'CRM/CRO/CRN do profissional';
COMMENT ON COLUMN public.medical_records.is_locked      IS 'Prontuário bloqueado para edição (após 24h ou assinatura)';
COMMENT ON COLUMN public.medical_records.lock_reason    IS 'Motivo do bloqueio (auto_24h, signed, admin)';

-- 2. Tabela de versões (audit trail)
CREATE TABLE IF NOT EXISTS public.medical_record_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id        UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version_number   INTEGER NOT NULL DEFAULT 1,
  changed_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason    TEXT,
  snapshot         JSONB NOT NULL,
  digital_hash     TEXT
);

ALTER TABLE public.medical_record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_record_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY "mrv_select" ON public.medical_record_versions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "mrv_insert" ON public.medical_record_versions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mrv_record ON public.medical_record_versions(record_id, version_number DESC);

COMMENT ON TABLE public.medical_record_versions IS 'Histórico de versões dos prontuários para audit trail';
COMMENT ON COLUMN public.medical_record_versions.snapshot IS 'Cópia completa dos campos do prontuário naquele momento';
