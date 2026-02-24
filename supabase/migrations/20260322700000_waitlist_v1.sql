-- ============================================================
-- MIGRAÇÃO: Lista de Espera (Waitlist)
-- Arquivo: 20260322700000_waitlist_v1.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.waitlist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id        UUID REFERENCES public.services(id) ON DELETE SET NULL,
  professional_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  specialty_id      UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  priority          TEXT NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('normal','alta','urgente')),
  status            TEXT NOT NULL DEFAULT 'aguardando'
                      CHECK (status IN ('aguardando','notificado','agendado','cancelado','expirado')),
  reason            TEXT,
  preferred_periods TEXT[],
  notified_at       TIMESTAMPTZ,
  scheduled_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist FORCE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_select" ON public.waitlist
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "waitlist_insert" ON public.waitlist
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "waitlist_update" ON public.waitlist
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "waitlist_delete" ON public.waitlist
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON public.waitlist(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_client ON public.waitlist(client_id);
