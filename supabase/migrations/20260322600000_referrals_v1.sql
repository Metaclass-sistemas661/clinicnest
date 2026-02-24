-- ============================================================
-- MIGRAÇÃO: Encaminhamentos entre Especialidades (Referrals)
-- Arquivo: 20260322600000_referrals_v1.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  from_professional UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_professional   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_specialty_id   UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','aceito','recusado','concluido','cancelado')),
  priority          TEXT NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('normal','urgente','emergencia')),
  reason            TEXT NOT NULL,
  clinical_summary  TEXT,
  notes             TEXT,
  responded_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals FORCE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select" ON public.referrals
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "referrals_insert" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "referrals_update" ON public.referrals
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_referrals_tenant ON public.referrals(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_from ON public.referrals(from_professional, status);
CREATE INDEX IF NOT EXISTS idx_referrals_to ON public.referrals(to_professional, status);
CREATE INDEX IF NOT EXISTS idx_referrals_client ON public.referrals(client_id);
