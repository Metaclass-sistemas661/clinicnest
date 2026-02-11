-- =====================================================
-- LGPD phase 3: portability export, controlled anonymization, SLA
-- =====================================================

-- -----------------------------------------------------
-- 1) SLA fields for lgpd_data_requests
-- -----------------------------------------------------
ALTER TABLE public.lgpd_data_requests
  ADD COLUMN IF NOT EXISTS sla_days INTEGER NOT NULL DEFAULT 15;

ALTER TABLE public.lgpd_data_requests
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lgpd_data_requests_sla_days_check'
      AND conrelid = 'public.lgpd_data_requests'::regclass
  ) THEN
    ALTER TABLE public.lgpd_data_requests
      ADD CONSTRAINT lgpd_data_requests_sla_days_check
      CHECK (sla_days BETWEEN 1 AND 90);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_lgpd_data_requests_due_at
  ON public.lgpd_data_requests (tenant_id, due_at, status);

CREATE OR REPLACE FUNCTION public.set_lgpd_data_request_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requested_at IS NULL THEN
    NEW.requested_at := now();
  END IF;

  IF NEW.sla_days IS NULL OR NEW.sla_days < 1 THEN
    NEW.sla_days := 15;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.sla_days IS DISTINCT FROM OLD.sla_days
     OR NEW.due_at IS NULL THEN
    NEW.due_at := NEW.requested_at + make_interval(days => NEW.sla_days);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lgpd_data_requests_set_deadline ON public.lgpd_data_requests;
CREATE TRIGGER lgpd_data_requests_set_deadline
  BEFORE INSERT OR UPDATE OF requested_at, sla_days, due_at
  ON public.lgpd_data_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lgpd_data_request_deadline();

UPDATE public.lgpd_data_requests
SET due_at = requested_at + make_interval(days => COALESCE(sla_days, 15))
WHERE due_at IS NULL;

ALTER TABLE public.lgpd_data_requests
  ALTER COLUMN due_at SET NOT NULL;

-- -----------------------------------------------------
-- 2) Data portability export (JSON payload for JSON/CSV generation)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_lgpd_data_subject(
  p_tenant_id UUID,
  p_target_user_id UUID,
  p_format TEXT DEFAULT 'json'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
  v_requester_is_admin BOOLEAN := FALSE;
  v_target_profile_id UUID;

  v_profile JSONB;
  v_roles JSONB;
  v_notifications JSONB;
  v_preferences JSONB;
  v_lgpd_requests JSONB;
  v_goal_suggestions JSONB;
  v_appointments JSONB;
  v_commissions JSONB;
  v_salaries JSONB;
  v_audit_logs JSONB;
  v_payload JSONB;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF lower(COALESCE(p_format, 'json')) NOT IN ('json', 'csv') THEN
    RAISE EXCEPTION 'Formato inválido. Use json ou csv.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = v_requester_user_id
      AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Sem acesso ao tenant informado';
  END IF;

  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, p_tenant_id);

  IF NOT v_requester_is_admin AND v_requester_user_id <> p_target_user_id THEN
    RAISE EXCEPTION 'Acesso negado para exportação de outro titular';
  END IF;

  SELECT p.id
  INTO v_target_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_target_user_id
    AND p.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Titular não encontrado neste tenant';
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'tenant_id', p.tenant_id,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  )
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_target_user_id
    AND p.tenant_id = p_tenant_id
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ur.id,
        'role', ur.role,
        'tenant_id', ur.tenant_id,
        'created_at', ur.created_at
      )
      ORDER BY ur.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = p_target_user_id
    AND ur.tenant_id = p_tenant_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'type', n.type,
        'title', n.title,
        'body', n.body,
        'metadata', n.metadata,
        'read_at', n.read_at,
        'created_at', n.created_at
      )
      ORDER BY n.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_notifications
  FROM public.notifications n
  WHERE n.tenant_id = p_tenant_id
    AND n.user_id = p_target_user_id;

  SELECT COALESCE(
    jsonb_build_object(
      'id', unp.id,
      'appointment_created', unp.appointment_created,
      'appointment_completed', unp.appointment_completed,
      'appointment_cancelled', unp.appointment_cancelled,
      'goal_approved', unp.goal_approved,
      'goal_rejected', unp.goal_rejected,
      'goal_reminder', unp.goal_reminder,
      'goal_reached', unp.goal_reached,
      'commission_paid', unp.commission_paid,
      'created_at', unp.created_at,
      'updated_at', unp.updated_at
    ),
    '{}'::jsonb
  )
  INTO v_preferences
  FROM public.user_notification_preferences unp
  WHERE unp.user_id = p_target_user_id
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'request_type', r.request_type,
        'request_details', r.request_details,
        'status', r.status,
        'requested_at', r.requested_at,
        'due_at', r.due_at,
        'resolved_at', r.resolved_at,
        'resolution_notes', r.resolution_notes
      )
      ORDER BY r.requested_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_lgpd_requests
  FROM public.lgpd_data_requests r
  WHERE r.tenant_id = p_tenant_id
    AND r.requester_user_id = p_target_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', gs.id,
        'name', gs.name,
        'goal_type', gs.goal_type,
        'target_value', gs.target_value,
        'period', gs.period,
        'status', gs.status,
        'rejection_reason', gs.rejection_reason,
        'created_at', gs.created_at,
        'reviewed_at', gs.reviewed_at
      )
      ORDER BY gs.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_goal_suggestions
  FROM public.goal_suggestions gs
  WHERE gs.tenant_id = p_tenant_id
    AND gs.professional_id = v_target_profile_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'scheduled_at', a.scheduled_at,
        'duration_minutes', a.duration_minutes,
        'status', a.status,
        'price', a.price,
        'notes', a.notes,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      )
      ORDER BY a.scheduled_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_appointments
  FROM public.appointments a
  WHERE a.tenant_id = p_tenant_id
    AND a.professional_id = v_target_profile_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'appointment_id', cp.appointment_id,
        'amount', cp.amount,
        'service_price', cp.service_price,
        'commission_type', cp.commission_type,
        'commission_value', cp.commission_value,
        'status', cp.status,
        'payment_date', cp.payment_date,
        'notes', cp.notes,
        'created_at', cp.created_at,
        'updated_at', cp.updated_at
      )
      ORDER BY cp.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_commissions
  FROM public.commission_payments cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.professional_id = p_target_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sp.id,
        'payment_month', sp.payment_month,
        'payment_year', sp.payment_year,
        'amount', sp.amount,
        'days_worked', sp.days_worked,
        'days_in_month', sp.days_in_month,
        'status', sp.status,
        'payment_date', sp.payment_date,
        'payment_method', sp.payment_method,
        'payment_reference', sp.payment_reference,
        'notes', sp.notes,
        'created_at', sp.created_at,
        'updated_at', sp.updated_at
      )
      ORDER BY sp.payment_year DESC, sp.payment_month DESC, sp.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_salaries
  FROM public.salary_payments sp
  WHERE sp.tenant_id = p_tenant_id
    AND sp.professional_id = p_target_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'entity_type', al.entity_type,
        'entity_id', al.entity_id,
        'metadata', al.metadata,
        'created_at', al.created_at
      )
      ORDER BY al.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_audit_logs
  FROM public.admin_audit_logs al
  WHERE al.tenant_id = p_tenant_id
    AND al.actor_user_id = p_target_user_id;

  v_payload := jsonb_build_object(
    'generated_at', now(),
    'format', lower(COALESCE(p_format, 'json')),
    'subject_user_id', p_target_user_id,
    'subject_profile', v_profile,
    'datasets', jsonb_build_object(
      'user_roles', v_roles,
      'notifications', v_notifications,
      'notification_preferences', v_preferences,
      'lgpd_requests', v_lgpd_requests,
      'goal_suggestions', v_goal_suggestions,
      'appointments', v_appointments,
      'commission_payments', v_commissions,
      'salary_payments', v_salaries,
      'admin_audit_logs', v_audit_logs
    )
  );

  IF v_requester_is_admin THEN
    PERFORM public.log_admin_action(
      p_tenant_id,
      'lgpd_data_exported',
      'profiles',
      p_target_user_id::text,
      jsonb_build_object(
        'requested_format', lower(COALESCE(p_format, 'json')),
        'target_user_id', p_target_user_id
      )
    );
  END IF;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.export_lgpd_data_subject(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_lgpd_data_subject(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_lgpd_data_subject(UUID, UUID, TEXT) TO service_role;

-- -----------------------------------------------------
-- 3) Controlled anonymization (dry-run + execution)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_lgpd_anonymization(
  p_tenant_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
  v_target_profile_id UUID;
  v_confirmation_token TEXT;
  v_is_target_admin BOOLEAN := FALSE;
  v_warnings JSONB := '[]'::jsonb;

  v_notifications_count INTEGER := 0;
  v_preferences_count INTEGER := 0;
  v_appointments_notes_count INTEGER := 0;
  v_goal_suggestions_count INTEGER := 0;
  v_commission_notes_count INTEGER := 0;
  v_salary_notes_count INTEGER := 0;
  v_lgpd_request_details_count INTEGER := 0;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_tenant_admin(v_requester_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem pré-visualizar anonimização';
  END IF;

  SELECT p.id
  INTO v_target_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_target_user_id
    AND p.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Titular não encontrado neste tenant';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.tenant_id = p_tenant_id
      AND ur.user_id = p_target_user_id
      AND ur.role = 'admin'
  )
  INTO v_is_target_admin;

  IF v_is_target_admin THEN
    v_warnings := v_warnings || jsonb_build_array(
      'O titular alvo possui perfil de administrador. Avalie impacto operacional antes de anonimizar.'
    );
  END IF;

  SELECT COUNT(*) INTO v_notifications_count
  FROM public.notifications n
  WHERE n.tenant_id = p_tenant_id
    AND n.user_id = p_target_user_id;

  SELECT COUNT(*) INTO v_preferences_count
  FROM public.user_notification_preferences unp
  WHERE unp.user_id = p_target_user_id;

  SELECT COUNT(*) INTO v_appointments_notes_count
  FROM public.appointments a
  WHERE a.tenant_id = p_tenant_id
    AND a.professional_id = v_target_profile_id
    AND a.notes IS NOT NULL;

  SELECT COUNT(*) INTO v_goal_suggestions_count
  FROM public.goal_suggestions gs
  WHERE gs.tenant_id = p_tenant_id
    AND gs.professional_id = v_target_profile_id
    AND (gs.name IS NOT NULL OR gs.rejection_reason IS NOT NULL);

  SELECT COUNT(*) INTO v_commission_notes_count
  FROM public.commission_payments cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.professional_id = p_target_user_id
    AND cp.notes IS NOT NULL;

  SELECT COUNT(*) INTO v_salary_notes_count
  FROM public.salary_payments sp
  WHERE sp.tenant_id = p_tenant_id
    AND sp.professional_id = p_target_user_id
    AND (sp.notes IS NOT NULL OR sp.payment_reference IS NOT NULL);

  SELECT COUNT(*) INTO v_lgpd_request_details_count
  FROM public.lgpd_data_requests lr
  WHERE lr.tenant_id = p_tenant_id
    AND lr.requester_user_id = p_target_user_id
    AND (lr.request_details IS NOT NULL OR lr.requester_email IS NOT NULL);

  v_confirmation_token := 'ANONYMIZE:' || p_target_user_id::text;

  RETURN jsonb_build_object(
    'target_user_id', p_target_user_id,
    'target_profile_id', v_target_profile_id,
    'confirmation_token', v_confirmation_token,
    'warnings', v_warnings,
    'summary', jsonb_build_object(
      'profile_rows', 1,
      'notifications_rows', v_notifications_count,
      'notification_preferences_rows', v_preferences_count,
      'appointments_notes_rows', v_appointments_notes_count,
      'goal_suggestions_rows', v_goal_suggestions_count,
      'commission_notes_rows', v_commission_notes_count,
      'salary_sensitive_rows', v_salary_notes_count,
      'lgpd_request_sensitive_rows', v_lgpd_request_details_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_lgpd_anonymization(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_lgpd_anonymization(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_lgpd_anonymization(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.execute_lgpd_anonymization(
  p_tenant_id UUID,
  p_target_user_id UUID,
  p_confirmation_token TEXT,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
  v_target_profile_id UUID;
  v_expected_token TEXT;

  v_profile_rows INTEGER := 0;
  v_notifications_rows INTEGER := 0;
  v_appointments_rows INTEGER := 0;
  v_goal_suggestions_rows INTEGER := 0;
  v_commission_rows INTEGER := 0;
  v_salary_rows INTEGER := 0;
  v_lgpd_rows INTEGER := 0;
  v_request_marked_rows INTEGER := 0;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_tenant_admin(v_requester_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar anonimização';
  END IF;

  SELECT p.id
  INTO v_target_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_target_user_id
    AND p.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Titular não encontrado neste tenant';
  END IF;

  v_expected_token := 'ANONYMIZE:' || p_target_user_id::text;
  IF COALESCE(p_confirmation_token, '') <> v_expected_token THEN
    RAISE EXCEPTION 'Token de confirmação inválido para anonimização';
  END IF;

  UPDATE public.profiles
  SET
    full_name = 'Titular anonimizado',
    email = NULL,
    phone = NULL,
    avatar_url = NULL,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND user_id = p_target_user_id;
  GET DIAGNOSTICS v_profile_rows = ROW_COUNT;

  UPDATE public.notifications
  SET
    title = 'Notificação anonimizada',
    body = NULL,
    metadata = '{}'::jsonb
  WHERE tenant_id = p_tenant_id
    AND user_id = p_target_user_id;
  GET DIAGNOSTICS v_notifications_rows = ROW_COUNT;

  UPDATE public.appointments
  SET notes = NULL, updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND professional_id = v_target_profile_id
    AND notes IS NOT NULL;
  GET DIAGNOSTICS v_appointments_rows = ROW_COUNT;

  UPDATE public.goal_suggestions
  SET
    name = NULL,
    rejection_reason = NULL
  WHERE tenant_id = p_tenant_id
    AND professional_id = v_target_profile_id
    AND (name IS NOT NULL OR rejection_reason IS NOT NULL);
  GET DIAGNOSTICS v_goal_suggestions_rows = ROW_COUNT;

  UPDATE public.commission_payments
  SET
    notes = NULL,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND professional_id = p_target_user_id
    AND notes IS NOT NULL;
  GET DIAGNOSTICS v_commission_rows = ROW_COUNT;

  UPDATE public.salary_payments
  SET
    notes = NULL,
    payment_reference = NULL,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND professional_id = p_target_user_id
    AND (notes IS NOT NULL OR payment_reference IS NOT NULL);
  GET DIAGNOSTICS v_salary_rows = ROW_COUNT;

  UPDATE public.lgpd_data_requests
  SET
    requester_email = NULL,
    request_details = '[ANONIMIZADO]',
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND requester_user_id = p_target_user_id
    AND (requester_email IS NOT NULL OR request_details IS NOT NULL);
  GET DIAGNOSTICS v_lgpd_rows = ROW_COUNT;

  IF p_request_id IS NOT NULL THEN
    UPDATE public.lgpd_data_requests
    SET
      status = 'completed',
      assigned_admin_user_id = v_requester_user_id,
      resolved_at = now(),
      resolution_notes = trim(
        BOTH FROM (
          COALESCE(resolution_notes || E'\n', '') ||
          'Anonimização executada em ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
        )
      ),
      updated_at = now()
    WHERE id = p_request_id
      AND tenant_id = p_tenant_id;
    GET DIAGNOSTICS v_request_marked_rows = ROW_COUNT;
  END IF;

  PERFORM public.log_admin_action(
    p_tenant_id,
    'lgpd_anonymization_executed',
    'profiles',
    p_target_user_id::text,
    jsonb_build_object(
      'profile_rows', v_profile_rows,
      'notifications_rows', v_notifications_rows,
      'appointments_rows', v_appointments_rows,
      'goal_suggestions_rows', v_goal_suggestions_rows,
      'commission_rows', v_commission_rows,
      'salary_rows', v_salary_rows,
      'lgpd_rows', v_lgpd_rows,
      'request_marked_rows', v_request_marked_rows
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_marked_completed', (v_request_marked_rows > 0),
    'summary', jsonb_build_object(
      'profile_rows', v_profile_rows,
      'notifications_rows', v_notifications_rows,
      'appointments_rows', v_appointments_rows,
      'goal_suggestions_rows', v_goal_suggestions_rows,
      'commission_rows', v_commission_rows,
      'salary_rows', v_salary_rows,
      'lgpd_rows', v_lgpd_rows
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_lgpd_anonymization(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_lgpd_anonymization(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_lgpd_anonymization(UUID, UUID, TEXT, UUID) TO service_role;
