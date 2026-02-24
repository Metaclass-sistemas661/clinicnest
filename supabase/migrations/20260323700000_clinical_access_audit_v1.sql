-- 12F: Auditoria de Acessos Clínicos (LGPD + ONA)

-- 1) RPC para registrar acesso a prontuário (12F.1)
CREATE OR REPLACE FUNCTION public.log_clinical_access(
  p_resource text,
  p_resource_id text DEFAULT NULL,
  p_patient_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_log_id uuid;
  v_is_flagged boolean := false;
  v_professional_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.tenant_id, p.professional_type::text
    INTO v_tenant_id, v_professional_type
    FROM public.profiles p
   WHERE p.user_id = v_user_id
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 12F.4: Flag acesso incomum — paciente sem agendamento recente deste profissional
  IF p_patient_id IS NOT NULL AND p_resource IN ('medical_records', 'clinical_evolutions', 'prescriptions', 'medical_certificates') THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.appointments a
       WHERE a.tenant_id = v_tenant_id
         AND a.professional_id = (SELECT id FROM public.profiles WHERE user_id = v_user_id AND tenant_id = v_tenant_id LIMIT 1)
         AND a.client_id = p_patient_id::uuid
         AND a.appointment_date >= (now() - interval '30 days')::date
       LIMIT 1
    ) THEN
      v_is_flagged := true;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_tenant_id,
    v_user_id,
    'clinical_access',
    p_resource,
    p_resource_id,
    jsonb_build_object(
      'patient_id', p_patient_id,
      'professional_type', v_professional_type,
      'is_flagged', v_is_flagged,
      'access_type', 'view'
    ) || COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_clinical_access(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_clinical_access(text, text, text, jsonb) TO authenticated;

-- 2) RPC para registrar tentativa de acesso negado (12F.2)
CREATE OR REPLACE FUNCTION public.log_access_denied(
  p_resource text,
  p_action text DEFAULT 'view',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_log_id uuid;
  v_professional_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.tenant_id, p.professional_type::text
    INTO v_tenant_id, v_professional_type
    FROM public.profiles p
   WHERE p.user_id = v_user_id
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_tenant_id,
    v_user_id,
    'access_denied',
    p_resource,
    NULL,
    jsonb_build_object(
      'attempted_action', p_action,
      'professional_type', v_professional_type,
      'source', 'frontend'
    ) || COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_denied(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_access_denied(text, text, jsonb) TO authenticated;

-- 3) RPC para relatório de acessos clínicos (12F.3) com joins de nomes
CREATE OR REPLACE FUNCTION public.get_clinical_access_report(
  p_start_date timestamptz DEFAULT (now() - interval '30 days'),
  p_end_date timestamptz DEFAULT now(),
  p_professional_id uuid DEFAULT NULL,
  p_resource_filter text DEFAULT NULL,
  p_flagged_only boolean DEFAULT false,
  p_limit_rows int DEFAULT 500
)
RETURNS TABLE (
  log_id uuid,
  created_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  actor_professional_type text,
  action text,
  resource text,
  resource_id text,
  patient_id text,
  patient_name text,
  is_flagged boolean,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
BEGIN
  SELECT p.tenant_id INTO v_tenant_id
    FROM public.profiles p
   WHERE p.user_id = v_user_id
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    al.id AS log_id,
    al.created_at,
    al.actor_user_id,
    COALESCE(pr.full_name, 'Desconhecido') AS actor_name,
    COALESCE(al.metadata->>'professional_type', '') AS actor_professional_type,
    al.action,
    al.entity_type AS resource,
    al.entity_id AS resource_id,
    al.metadata->>'patient_id' AS patient_id,
    cl.name AS patient_name,
    COALESCE((al.metadata->>'is_flagged')::boolean, false) AS is_flagged,
    al.metadata
  FROM public.audit_logs al
  LEFT JOIN public.profiles pr
    ON pr.user_id = al.actor_user_id AND pr.tenant_id = v_tenant_id
  LEFT JOIN public.clients cl
    ON cl.id::text = al.metadata->>'patient_id' AND cl.tenant_id = v_tenant_id
  WHERE al.tenant_id = v_tenant_id
    AND al.action IN ('clinical_access', 'access_denied')
    AND al.created_at >= p_start_date
    AND al.created_at <= p_end_date
    AND (p_professional_id IS NULL OR al.actor_user_id = p_professional_id)
    AND (p_resource_filter IS NULL OR al.entity_type = p_resource_filter)
    AND (NOT p_flagged_only OR COALESCE((al.metadata->>'is_flagged')::boolean, false) = true)
  ORDER BY al.created_at DESC
  LIMIT p_limit_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.get_clinical_access_report(timestamptz, timestamptz, uuid, text, boolean, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clinical_access_report(timestamptz, timestamptz, uuid, text, boolean, int) TO authenticated;

-- 4) Índice para acelerar queries de auditoria clínica
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinical_action
  ON public.audit_logs (tenant_id, action, created_at DESC)
  WHERE action IN ('clinical_access', 'access_denied');

CREATE INDEX IF NOT EXISTS idx_audit_logs_flagged
  ON public.audit_logs (tenant_id, created_at DESC)
  WHERE action = 'clinical_access' AND (metadata->>'is_flagged')::boolean = true;
