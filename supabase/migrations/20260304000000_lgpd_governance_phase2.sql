-- =====================================================
-- LGPD phase 2: data subject rights, retention, audit trail
-- =====================================================

-- -----------------------------------------------------
-- 1) Data subject requests (direitos do titular)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lgpd_data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL,
  requester_email TEXT,
  request_type TEXT NOT NULL CHECK (
    request_type IN (
      'access',
      'correction',
      'deletion',
      'portability',
      'consent_revocation',
      'opposition'
    )
  ),
  request_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'completed', 'rejected')
  ),
  assigned_admin_user_id UUID,
  resolution_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_data_requests_tenant_status
  ON public.lgpd_data_requests (tenant_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_lgpd_data_requests_requester
  ON public.lgpd_data_requests (requester_user_id, requested_at DESC);

ALTER TABLE public.lgpd_data_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requester can insert own lgpd requests" ON public.lgpd_data_requests;
CREATE POLICY "Requester can insert own lgpd requests"
  ON public.lgpd_data_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = lgpd_data_requests.tenant_id
    )
  );

DROP POLICY IF EXISTS "Requester can view own lgpd requests" ON public.lgpd_data_requests;
CREATE POLICY "Requester can view own lgpd requests"
  ON public.lgpd_data_requests
  FOR SELECT
  TO authenticated
  USING (
    requester_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = lgpd_data_requests.tenant_id
    )
  );

DROP POLICY IF EXISTS "Tenant admins can view all lgpd requests" ON public.lgpd_data_requests;
CREATE POLICY "Tenant admins can view all lgpd requests"
  ON public.lgpd_data_requests
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can update lgpd requests" ON public.lgpd_data_requests;
CREATE POLICY "Tenant admins can update lgpd requests"
  ON public.lgpd_data_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

DROP TRIGGER IF EXISTS lgpd_data_requests_updated_at ON public.lgpd_data_requests;
CREATE TRIGGER lgpd_data_requests_updated_at
  BEFORE UPDATE ON public.lgpd_data_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------
-- 2) Retention governance settings per tenant
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lgpd_retention_policies (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_data_retention_days INTEGER NOT NULL DEFAULT 1825 CHECK (client_data_retention_days BETWEEN 30 AND 7300),
  financial_data_retention_days INTEGER NOT NULL DEFAULT 3650 CHECK (financial_data_retention_days BETWEEN 365 AND 7300),
  audit_log_retention_days INTEGER NOT NULL DEFAULT 730 CHECK (audit_log_retention_days BETWEEN 30 AND 3650),
  auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT false,
  last_reviewed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.lgpd_retention_policies (tenant_id)
SELECT t.id
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_default_lgpd_retention_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lgpd_retention_policies (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_create_default_lgpd_retention_policy ON public.tenants;
CREATE TRIGGER tenants_create_default_lgpd_retention_policy
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_lgpd_retention_policy();

ALTER TABLE public.lgpd_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can view retention policy" ON public.lgpd_retention_policies;
CREATE POLICY "Tenant admins can view retention policy"
  ON public.lgpd_retention_policies
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can update retention policy" ON public.lgpd_retention_policies;
CREATE POLICY "Tenant admins can update retention policy"
  ON public.lgpd_retention_policies
  FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can insert retention policy" ON public.lgpd_retention_policies;
CREATE POLICY "Tenant admins can insert retention policy"
  ON public.lgpd_retention_policies
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

DROP TRIGGER IF EXISTS lgpd_retention_policies_updated_at ON public.lgpd_retention_policies;
CREATE TRIGGER lgpd_retention_policies_updated_at
  BEFORE UPDATE ON public.lgpd_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------
-- 3) Administrative audit trail
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tenant_created_at
  ON public.admin_audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs (actor_user_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Tenant admins can view audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_tenant_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_log_id UUID;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Ação de auditoria é obrigatória';
  END IF;

  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'Tipo de entidade é obrigatório';
  END IF;

  IF NOT public.is_tenant_admin(v_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar trilha de auditoria';
  END IF;

  INSERT INTO public.admin_audit_logs (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_tenant_id,
    v_actor_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
