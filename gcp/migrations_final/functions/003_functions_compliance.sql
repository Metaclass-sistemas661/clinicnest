-- ============================================================
-- GCP Cloud SQL Migration - 003_functions_compliance.sql
-- Execution Order: 010
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: Functions - compliance
-- Total: 30 functions


-- ============================================
-- Function: audit_support_ticket_insert
-- Source: 20260215172000_audit_logs_core.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_support_ticket_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_tenant_action(
    NEW.tenant_id,
    NEW.created_by,
    'support_ticket_created',
    'support_ticket',
    NEW.id::text,
    jsonb_build_object(
      'subject', NEW.subject,
      'category', NEW.category,
      'priority', NEW.priority,
      'channel', NEW.channel,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: audit_support_message_insert
-- Source: 20260215172000_audit_logs_core.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_support_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_tenant_action(
    NEW.tenant_id,
    COALESCE(NEW.created_by, current_setting('app.current_user_id')::uuid),
    'support_message_created',
    'support_message',
    NEW.id::text,
    jsonb_build_object(
      'ticket_id', NEW.ticket_id::text,
      'sender', NEW.sender
    )
  );
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: create_default_lgpd_retention_policy
-- Source: 20260304000000_lgpd_governance_phase2.sql
-- ============================================
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


-- ============================================
-- Function: set_lgpd_data_request_deadline
-- Source: 20260305000000_lgpd_phase3_portability_anonymization_sla.sql
-- ============================================
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


-- ============================================
-- Function: export_lgpd_data_subject
-- Source: 20260305000000_lgpd_phase3_portability_anonymization_sla.sql
-- ============================================
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
  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;
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


-- ============================================
-- Function: preview_lgpd_anonymization
-- Source: 20260305000000_lgpd_phase3_portability_anonymization_sla.sql
-- ============================================
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
  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;
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


-- ============================================
-- Function: execute_lgpd_anonymization
-- Source: 20260305000000_lgpd_phase3_portability_anonymization_sla.sql
-- ============================================
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
  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;
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


-- ============================================
-- Function: upsert_professional_working_hours_v1
-- Source: 20260311000000_agenda_availability_blocks_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_professional_working_hours_v1(
  p_professional_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  -- Staff can only edit own schedule
  IF NOT v_is_admin AND p_professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para editar disponibilidade de outro profissional' USING DETAIL = 'FORBIDDEN';
  END IF;

  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'Dia da semana inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'Intervalo de horário inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.professional_working_hours (
    tenant_id, professional_id, day_of_week, start_time, end_time, is_active
  ) VALUES (
    v_profile.tenant_id, p_professional_id, p_day_of_week, p_start_time, p_end_time, COALESCE(p_is_active, true)
  )
  ON CONFLICT (tenant_id, professional_id, day_of_week)
  DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'professional_working_hours_upserted',
    'professional_working_hours',
    v_id::text,
    jsonb_build_object(
      'professional_id', p_professional_id,
      'day_of_week', p_day_of_week,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'is_active', COALESCE(p_is_active, true)
    )
  );

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;


-- ============================================
-- Function: is_clinical_professional
-- Source: 20260325000001_odontograms_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.is_clinical_professional(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND professional_type IN (
        'medico'::public.professional_type,
        'dentista'::public.professional_type,
        'enfermeiro'::public.professional_type,
        'fisioterapeuta'::public.professional_type,
        'nutricionista'::public.professional_type,
        'psicologo'::public.professional_type,
        'fonoaudiologo'::public.professional_type
      )
  );
$$;


-- ============================================
-- Function: is_nursing_professional
-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.is_nursing_professional(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND professional_type IN ('enfermeiro','tec_enfermagem')
  );
$$;


-- ============================================
-- Function: sngpc_proximo_numero
-- Source: 20260323900000_sngpc_livro_registro_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION sngpc_proximo_numero(
  p_tenant_id UUID,
  p_tipo_receituario TEXT
) RETURNS TABLE(numero TEXT, serie TEXT) AS $$
DECLARE
  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_sequencial INTEGER;
  v_prefixo TEXT;
BEGIN
  -- Determinar prefixo
  v_prefixo := CASE p_tipo_receituario
    WHEN 'AMARELA' THEN 'A'
    WHEN 'AZUL' THEN 'B'
    ELSE 'C'
  END;
  
  -- Inserir ou atualizar sequencial
  INSERT INTO sngpc_sequencial (tenant_id, tipo_receituario, ano, ultimo_numero)
  VALUES (p_tenant_id, p_tipo_receituario, v_ano, 1)
  ON CONFLICT (tenant_id, tipo_receituario, ano)
  DO UPDATE SET 
    ultimo_numero = sngpc_sequencial.ultimo_numero + 1,
    updated_at = NOW()
  RETURNING ultimo_numero INTO v_sequencial;
  
  RETURN QUERY SELECT 
    LPAD(v_sequencial::TEXT, 6, '0'),
    v_prefixo || v_ano::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: sngpc_registrar_entrada
-- Source: 20260323900000_sngpc_livro_registro_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION sngpc_registrar_entrada(
  p_tenant_id UUID,
  p_medicamento_codigo TEXT,
  p_medicamento_nome TEXT,
  p_lista TEXT,
  p_lote TEXT,
  p_data_fabricacao DATE,
  p_data_validade DATE,
  p_quantidade INTEGER,
  p_unidade TEXT,
  p_fornecedor_id UUID,
  p_nota_fiscal TEXT,
  p_preco_unitario DECIMAL,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_observacoes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_estoque_id UUID;
BEGIN
  -- Inserir no estoque
  INSERT INTO sngpc_estoque (
    tenant_id, medicamento_codigo, medicamento_nome, lista,
    lote, data_fabricacao, data_validade, quantidade_inicial,
    quantidade_atual, unidade, fornecedor_id, nota_fiscal,
    preco_unitario, observacoes
  ) VALUES (
    p_tenant_id, p_medicamento_codigo, p_medicamento_nome, p_lista,
    p_lote, p_data_fabricacao, p_data_validade, p_quantidade,
    p_quantidade, p_unidade, p_fornecedor_id, p_nota_fiscal,
    p_preco_unitario, p_observacoes
  ) RETURNING id INTO v_estoque_id;
  
  -- Registrar movimentação
  INSERT INTO sngpc_movimentacoes (
    tenant_id, estoque_id, tipo_movimentacao, quantidade,
    saldo_anterior, saldo_posterior, fornecedor_nome, nota_fiscal,
    usuario_id, usuario_nome, observacoes
  ) VALUES (
    p_tenant_id, v_estoque_id, 'ENTRADA_COMPRA', p_quantidade,
    0, p_quantidade,
    (SELECT name FROM suppliers WHERE id = p_fornecedor_id),
    p_nota_fiscal, p_usuario_id, p_usuario_nome, p_observacoes
  );
  
  RETURN v_estoque_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: sngpc_registrar_dispensacao
-- Source: 20260323900000_sngpc_livro_registro_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION sngpc_registrar_dispensacao(
  p_tenant_id UUID,
  p_estoque_id UUID,
  p_quantidade INTEGER,
  p_paciente_id UUID,
  p_paciente_nome TEXT,
  p_paciente_cpf TEXT,
  p_prescriptor_nome TEXT,
  p_prescriptor_crm TEXT,
  p_numero_receita TEXT,
  p_comprador_nome TEXT DEFAULT NULL,
  p_comprador_rg TEXT DEFAULT NULL,
  p_comprador_endereco TEXT DEFAULT NULL,
  p_comprador_telefone TEXT DEFAULT NULL,
  p_comprador_parentesco TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nome TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_saldo_atual INTEGER;
  v_mov_id UUID;
BEGIN
  -- Obter saldo atual
  SELECT quantidade_atual INTO v_saldo_atual
  FROM sngpc_estoque WHERE id = p_estoque_id FOR UPDATE;
  
  IF v_saldo_atual < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_saldo_atual, p_quantidade;
  END IF;
  
  -- Atualizar estoque
  UPDATE sngpc_estoque 
  SET quantidade_atual = quantidade_atual - p_quantidade,
      updated_at = NOW()
  WHERE id = p_estoque_id;
  
  -- Registrar movimentação
  INSERT INTO sngpc_movimentacoes (
    tenant_id, estoque_id, tipo_movimentacao, quantidade,
    saldo_anterior, saldo_posterior,
    paciente_id, paciente_nome, paciente_cpf,
    prescriptor_nome, prescriptor_crm, numero_receita,
    comprador_nome, comprador_rg, comprador_endereco,
    comprador_telefone, comprador_parentesco,
    usuario_id, usuario_nome, observacoes
  ) VALUES (
    p_tenant_id, p_estoque_id, 'SAIDA_DISPENSACAO', p_quantidade,
    v_saldo_atual, v_saldo_atual - p_quantidade,
    p_paciente_id, p_paciente_nome, p_paciente_cpf,
    p_prescriptor_nome, p_prescriptor_crm, p_numero_receita,
    p_comprador_nome, p_comprador_rg, p_comprador_endereco,
    p_comprador_telefone, p_comprador_parentesco,
    p_usuario_id, p_usuario_nome, p_observacoes
  ) RETURNING id INTO v_mov_id;
  
  RETURN v_mov_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: sngpc_registrar_perda
-- Source: 20260323900000_sngpc_livro_registro_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION sngpc_registrar_perda(
  p_tenant_id UUID,
  p_estoque_id UUID,
  p_quantidade INTEGER,
  p_tipo TEXT, -- 'SAIDA_PERDA' ou 'SAIDA_VENCIMENTO'
  p_motivo TEXT,
  p_boletim_ocorrencia TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nome TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_saldo_atual INTEGER;
  v_mov_id UUID;
BEGIN
  SELECT quantidade_atual INTO v_saldo_atual
  FROM sngpc_estoque WHERE id = p_estoque_id FOR UPDATE;
  
  IF v_saldo_atual < p_quantidade THEN
    RAISE EXCEPTION 'Quantidade a baixar maior que saldo disponível';
  END IF;
  
  UPDATE sngpc_estoque 
  SET quantidade_atual = quantidade_atual - p_quantidade,
      updated_at = NOW()
  WHERE id = p_estoque_id;
  
  INSERT INTO sngpc_movimentacoes (
    tenant_id, estoque_id, tipo_movimentacao, quantidade,
    saldo_anterior, saldo_posterior,
    motivo_perda, numero_boletim_ocorrencia,
    usuario_id, usuario_nome
  ) VALUES (
    p_tenant_id, p_estoque_id, p_tipo, p_quantidade,
    v_saldo_atual, v_saldo_atual - p_quantidade,
    p_motivo, p_boletim_ocorrencia,
    p_usuario_id, p_usuario_nome
  ) RETURNING id INTO v_mov_id;
  
  RETURN v_mov_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: update_sngpc_transmissoes_updated_at
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_sngpc_transmissoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: log_sngpc_transmissao_change
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION log_sngpc_transmissao_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO sngpc_transmissoes_log (
      transmissao_id,
      acao,
      status_anterior,
      status_novo,
      executado_por
    ) VALUES (
      NEW.id,
      'mudanca_status',
      OLD.status,
      NEW.status,
      current_setting('app.current_user_id')::uuid
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: criar_transmissao_sngpc
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION criar_transmissao_sngpc(
  p_tipo sngpc_transmissao_tipo,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_xml TEXT,
  p_total_entradas INTEGER DEFAULT 0,
  p_total_saidas_venda INTEGER DEFAULT 0,
  p_total_saidas_transferencia INTEGER DEFAULT 0,
  p_total_saidas_perda INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
  v_transmissao_id UUID;
BEGIN
  -- Obter tenant e usuário
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;
  v_user_id := current_setting('app.current_user_id')::uuid;
  SELECT full_name INTO v_user_name FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não associado a um tenant';
  END IF;
  
  -- Criar transmissão
  INSERT INTO sngpc_transmissoes (
    tenant_id,
    tipo,
    data_inicio,
    data_fim,
    xml_enviado,
    status,
    total_entradas,
    total_saidas_venda,
    total_saidas_transferencia,
    total_saidas_perda,
    total_medicamentos,
    enviado_por,
    enviado_por_nome
  ) VALUES (
    v_tenant_id,
    p_tipo,
    p_data_inicio,
    p_data_fim,
    p_xml,
    'pendente',
    p_total_entradas,
    p_total_saidas_venda,
    p_total_saidas_transferencia,
    p_total_saidas_perda,
    p_total_entradas + p_total_saidas_venda + p_total_saidas_transferencia + p_total_saidas_perda,
    v_user_id,
    v_user_name
  )
  RETURNING id INTO v_transmissao_id;
  
  -- Registrar log
  INSERT INTO sngpc_transmissoes_log (
    transmissao_id,
    acao,
    status_novo,
    executado_por
  ) VALUES (
    v_transmissao_id,
    'criacao',
    'pendente',
    v_user_id
  );
  
  RETURN v_transmissao_id;
END;
$$;


-- ============================================
-- Function: atualizar_transmissao_sngpc
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION atualizar_transmissao_sngpc(
  p_transmissao_id UUID,
  p_status sngpc_transmissao_status,
  p_hash VARCHAR DEFAULT NULL,
  p_resposta JSONB DEFAULT NULL,
  p_erros TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Verificar permissão
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;
  
  IF NOT EXISTS (
    SELECT 1 FROM sngpc_transmissoes 
    WHERE id = p_transmissao_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Transmissão não encontrada ou sem permissão';
  END IF;
  
  -- Atualizar transmissão
  UPDATE sngpc_transmissoes SET
    status = p_status,
    hash_anvisa = COALESCE(p_hash, hash_anvisa),
    resposta_anvisa = COALESCE(p_resposta, resposta_anvisa),
    erros = COALESCE(p_erros, erros),
    data_envio = CASE WHEN p_status IN ('enviado', 'validado', 'erro', 'rejeitado') THEN COALESCE(data_envio, NOW()) ELSE data_envio END,
    data_validacao = CASE WHEN p_status = 'validado' THEN NOW() ELSE data_validacao END
  WHERE id = p_transmissao_id;
  
  RETURN TRUE;
END;
$$;


-- ============================================
-- Function: register_backup
-- Source: 20260324400000_backup_logs_sbis_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION register_backup(
  p_tenant_id UUID,
  p_backup_id TEXT,
  p_backup_type TEXT,
  p_size_bytes BIGINT DEFAULT NULL,
  p_tables_count INTEGER DEFAULT NULL,
  p_records_count BIGINT DEFAULT NULL,
  p_storage_location TEXT DEFAULT NULL,
  p_storage_provider TEXT DEFAULT 'supabase',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_retention_days INTEGER;
BEGIN
  -- Buscar política de retenção
  SELECT retention_days INTO v_retention_days
  FROM backup_retention_policies
  WHERE tenant_id = p_tenant_id
    AND (backup_type = p_backup_type OR backup_type = 'all')
    AND enabled = true
  ORDER BY backup_type DESC
  LIMIT 1;
  
  v_retention_days := COALESCE(v_retention_days, 365);
  
  INSERT INTO backup_logs (
    tenant_id, backup_id, backup_type, started_at,
    size_bytes, tables_count, records_count,
    storage_location, storage_provider,
    retention_days, expires_at, metadata
  ) VALUES (
    p_tenant_id, p_backup_id, p_backup_type, NOW(),
    p_size_bytes, p_tables_count, p_records_count,
    p_storage_location, p_storage_provider,
    v_retention_days, NOW() + (v_retention_days || ' days')::INTERVAL, p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


-- ============================================
-- Function: complete_backup
-- Source: 20260324400000_backup_logs_sbis_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION complete_backup(
  p_log_id UUID,
  p_checksum TEXT,
  p_duration_seconds INTEGER DEFAULT NULL,
  p_size_bytes BIGINT DEFAULT NULL,
  p_records_count BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE backup_logs
  SET 
    status = 'completed',
    completed_at = NOW(),
    checksum_value = p_checksum,
    duration_seconds = COALESCE(p_duration_seconds, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER),
    size_bytes = COALESCE(p_size_bytes, size_bytes),
    records_count = COALESCE(p_records_count, records_count)
  WHERE id = p_log_id;
  
  RETURN FOUND;
END;
$$;


-- ============================================
-- Function: verify_backup
-- Source: 20260324400000_backup_logs_sbis_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION verify_backup(
  p_log_id UUID,
  p_verification_checksum TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  verified BOOLEAN,
  match_result BOOLEAN,
  original_checksum TEXT,
  verification_checksum TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_checksum TEXT;
  v_match BOOLEAN;
  v_tenant_id UUID;
BEGIN
  -- Buscar checksum original
  SELECT checksum_value, tenant_id 
  INTO v_original_checksum, v_tenant_id
  FROM backup_logs
  WHERE id = p_log_id;
  
  IF v_original_checksum IS NULL THEN
    RETURN QUERY SELECT false, false, ''::TEXT, p_verification_checksum;
    RETURN;
  END IF;
  
  -- Comparar checksums
  v_match := (v_original_checksum = p_verification_checksum);
  
  -- Atualizar log
  UPDATE backup_logs
  SET 
    status = CASE WHEN v_match THEN 'verified' ELSE 'corrupted' END,
    verification_checksum = p_verification_checksum,
    verified_at = NOW(),
    verified_by = COALESCE(p_user_id, current_setting('app.current_user_id')::uuid)
  WHERE id = p_log_id;
  
  -- Registrar verificação
  INSERT INTO backup_verifications (
    tenant_id, backup_log_id, verification_type, status,
    checksum_match, performed_by
  ) VALUES (
    v_tenant_id, p_log_id, 'checksum',
    CASE WHEN v_match THEN 'passed' ELSE 'failed' END,
    v_match, COALESCE(p_user_id, current_setting('app.current_user_id')::uuid)
  );
  
  RETURN QUERY SELECT true, v_match, v_original_checksum, p_verification_checksum;
END;
$$;


-- ============================================
-- Function: get_backup_report
-- Source: 20260324400000_backup_logs_sbis_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_backup_report(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_backups BIGINT,
  successful_backups BIGINT,
  failed_backups BIGINT,
  verified_backups BIGINT,
  corrupted_backups BIGINT,
  total_size_gb NUMERIC,
  avg_duration_minutes NUMERIC,
  last_backup_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  compliance_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end DATE := COALESCE(p_end_date, CURRENT_DATE);
  v_total BIGINT;
  v_successful BIGINT;
  v_failed BIGINT;
  v_verified BIGINT;
  v_corrupted BIGINT;
  v_size NUMERIC;
  v_duration NUMERIC;
  v_last_backup TIMESTAMPTZ;
  v_last_verified TIMESTAMPTZ;
  v_compliance TEXT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed', 'verified')),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'verified'),
    COUNT(*) FILTER (WHERE status = 'corrupted'),
    COALESCE(SUM(size_bytes) / 1073741824.0, 0),
    COALESCE(AVG(duration_seconds) / 60.0, 0),
    MAX(completed_at),
    MAX(verified_at)
  INTO v_total, v_successful, v_failed, v_verified, v_corrupted, v_size, v_duration, v_last_backup, v_last_verified
  FROM backup_logs
  WHERE tenant_id = p_tenant_id
    AND created_at >= v_start
    AND created_at <= v_end + INTERVAL '1 day';
  
  -- Determinar status de compliance SBIS
  IF v_corrupted > 0 THEN
    v_compliance := 'NON_COMPLIANT';
  ELSIF v_last_backup IS NULL OR v_last_backup < NOW() - INTERVAL '24 hours' THEN
    v_compliance := 'WARNING';
  ELSIF v_verified = 0 THEN
    v_compliance := 'PENDING_VERIFICATION';
  ELSIF v_failed > v_successful * 0.1 THEN
    v_compliance := 'WARNING';
  ELSE
    v_compliance := 'COMPLIANT';
  END IF;
  
  RETURN QUERY SELECT 
    v_total, v_successful, v_failed, v_verified, v_corrupted,
    v_size, v_duration, v_last_backup, v_last_verified, v_compliance;
END;
$$;


-- ============================================
-- Function: cleanup_expired_backups
-- Source: 20260324400000_backup_logs_sbis_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_backups(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM backup_logs
    WHERE expires_at < NOW()
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND status IN ('completed', 'verified')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  
  RETURN v_deleted;
END;
$$;


-- ============================================
-- Function: calcular_prazo_lgpd
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calcular_prazo_lgpd()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prazo de 15 dias para resposta (Art. 18 § 3º)
  NEW.prazo_resposta := NEW.data_solicitacao + INTERVAL '15 days';
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: calcular_indicadores_ona
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calcular_indicadores_ona(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE,
  p_tipo_periodo TEXT DEFAULT 'MENSAL'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_espera RECORD;
  v_cancel RECORD;
  v_prontuario RECORD;
  v_salas RECORD;
  v_retorno RECORD;
  v_nps RECORD;
  v_eventos RECORD;
BEGIN
  -- Calcula cada indicador
  SELECT * INTO v_espera FROM calc_tempo_espera(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_cancel FROM calc_taxa_cancelamento(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_prontuario FROM calc_completude_prontuario(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_salas FROM calc_ocupacao_salas(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_retorno FROM calc_retorno_nao_programado(p_tenant_id, p_inicio, p_fim);
  SELECT * INTO v_nps FROM calc_nps(p_tenant_id, p_inicio, p_fim);
  
  -- Conta eventos adversos
  SELECT 
    COUNT(*) as total,
    jsonb_object_agg(severidade, cnt) FILTER (WHERE severidade IS NOT NULL) as por_severidade,
    jsonb_object_agg(tipo, cnt) FILTER (WHERE tipo IS NOT NULL) as por_tipo
  INTO v_eventos
  FROM (
    SELECT severidade::TEXT, COUNT(*) as cnt FROM adverse_events 
    WHERE tenant_id = p_tenant_id AND data_evento BETWEEN p_inicio AND p_fim
    GROUP BY severidade
  ) s, (
    SELECT tipo::TEXT, COUNT(*) as cnt FROM adverse_events 
    WHERE tenant_id = p_tenant_id AND data_evento BETWEEN p_inicio AND p_fim
    GROUP BY tipo
  ) t;
  
  -- Insere ou atualiza snapshot
  INSERT INTO ona_indicators (
    tenant_id, periodo_inicio, periodo_fim, tipo_periodo,
    tempo_espera_medio, tempo_espera_min, tempo_espera_max, tempo_espera_p90, total_atendimentos_espera,
    taxa_cancelamento, taxa_noshow, total_agendamentos, total_cancelados, total_noshow, total_realizados,
    completude_prontuario, total_prontuarios, prontuarios_completos, campos_obrigatorios_faltantes,
    taxa_ocupacao_salas, horas_disponiveis, horas_ocupadas, ocupacao_por_sala,
    taxa_retorno_nao_programado, total_retornos_7dias, total_atendimentos_periodo,
    nps_score, nps_promotores, nps_neutros, nps_detratores, total_respostas_nps,
    total_eventos_adversos, eventos_por_severidade, eventos_por_tipo
  ) VALUES (
    p_tenant_id, p_inicio, p_fim, p_tipo_periodo,
    v_espera.media, v_espera.minimo, v_espera.maximo, v_espera.p90, v_espera.total,
    v_cancel.taxa_cancel, v_cancel.taxa_ns, v_cancel.total_agend, v_cancel.total_cancel, v_cancel.total_ns, v_cancel.total_realiz,
    v_prontuario.completude, v_prontuario.total, v_prontuario.completos, v_prontuario.campos_faltantes,
    v_salas.taxa, v_salas.horas_disp, v_salas.horas_ocup, v_salas.por_sala,
    v_retorno.taxa, v_retorno.retornos_7dias, v_retorno.total_atend,
    v_nps.score, v_nps.promotores, v_nps.neutros, v_nps.detratores, v_nps.total,
    COALESCE(v_eventos.total, 0), v_eventos.por_severidade, v_eventos.por_tipo
  )
  ON CONFLICT (tenant_id, periodo_inicio, periodo_fim, tipo_periodo) 
  DO UPDATE SET
    tempo_espera_medio = EXCLUDED.tempo_espera_medio,
    tempo_espera_min = EXCLUDED.tempo_espera_min,
    tempo_espera_max = EXCLUDED.tempo_espera_max,
    tempo_espera_p90 = EXCLUDED.tempo_espera_p90,
    total_atendimentos_espera = EXCLUDED.total_atendimentos_espera,
    taxa_cancelamento = EXCLUDED.taxa_cancelamento,
    taxa_noshow = EXCLUDED.taxa_noshow,
    total_agendamentos = EXCLUDED.total_agendamentos,
    total_cancelados = EXCLUDED.total_cancelados,
    total_noshow = EXCLUDED.total_noshow,
    total_realizados = EXCLUDED.total_realizados,
    completude_prontuario = EXCLUDED.completude_prontuario,
    total_prontuarios = EXCLUDED.total_prontuarios,
    prontuarios_completos = EXCLUDED.prontuarios_completos,
    campos_obrigatorios_faltantes = EXCLUDED.campos_obrigatorios_faltantes,
    taxa_ocupacao_salas = EXCLUDED.taxa_ocupacao_salas,
    horas_disponiveis = EXCLUDED.horas_disponiveis,
    horas_ocupadas = EXCLUDED.horas_ocupadas,
    ocupacao_por_sala = EXCLUDED.ocupacao_por_sala,
    taxa_retorno_nao_programado = EXCLUDED.taxa_retorno_nao_programado,
    total_retornos_7dias = EXCLUDED.total_retornos_7dias,
    total_atendimentos_periodo = EXCLUDED.total_atendimentos_periodo,
    nps_score = EXCLUDED.nps_score,
    nps_promotores = EXCLUDED.nps_promotores,
    nps_neutros = EXCLUDED.nps_neutros,
    nps_detratores = EXCLUDED.nps_detratores,
    total_respostas_nps = EXCLUDED.total_respostas_nps,
    total_eventos_adversos = EXCLUDED.total_eventos_adversos,
    eventos_por_severidade = EXCLUDED.eventos_por_severidade,
    eventos_por_tipo = EXCLUDED.eventos_por_tipo,
    calculado_em = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;


-- ============================================
-- Function: check_retention_before_delete
-- Source: 20260324700000_cfm_retention_policy_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION check_retention_before_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
  v_client_name TEXT;
  v_retention_expires DATE;
  v_tenant_id UUID;
BEGIN
  -- Determina o client_id baseado na tabela
  IF TG_TABLE_NAME = 'clients' THEN
    v_client_id := OLD.id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'medical_records' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'prescriptions' THEN
    SELECT client_id, tenant_id INTO v_client_id, v_tenant_id
    FROM medical_records WHERE id = OLD.medical_record_id;
  ELSIF TG_TABLE_NAME = 'triage_records' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'clinical_evolutions' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSIF TG_TABLE_NAME = 'nursing_evolutions' THEN
    v_client_id := OLD.client_id;
    v_tenant_id := OLD.tenant_id;
  ELSE
    -- Tabela não protegida, permite exclusão
    RETURN OLD;
  END IF;
  
  -- Busca dados do cliente
  SELECT name, retention_expires_at 
  INTO v_client_name, v_retention_expires
  FROM clients WHERE id = v_client_id;
  
  -- Se não tem data de expiração, usa data atual + 20 anos (conservador)
  IF v_retention_expires IS NULL THEN
    v_retention_expires := CURRENT_DATE + INTERVAL '20 years';
  END IF;
  
  -- Verifica se ainda está no período de retenção
  IF v_retention_expires > CURRENT_DATE THEN
    -- Registra a tentativa bloqueada
    INSERT INTO retention_deletion_attempts (
      tenant_id, user_id, table_name, record_id, 
      client_id, client_name, retention_expires_at, reason
    ) VALUES (
      v_tenant_id, current_setting('app.current_user_id')::uuid, TG_TABLE_NAME, OLD.id,
      v_client_id, v_client_name, v_retention_expires,
      'Tentativa de exclusão bloqueada: dados ainda no período de retenção CFM (expira em ' || 
      TO_CHAR(v_retention_expires, 'DD/MM/YYYY') || ')'
    );
    
    -- Bloqueia a exclusão
    RAISE EXCEPTION 'BLOQUEADO: Não é permitido excluir dados clínicos antes do período de retenção (CFM 1.821/2007). Este registro só pode ser excluído após %', 
      TO_CHAR(v_retention_expires, 'DD/MM/YYYY');
  END IF;
  
  -- Permite exclusão se passou do período
  RETURN OLD;
END;
$$;


-- ============================================
-- Function: get_clients_near_retention_expiry
-- Source: 20260324700000_cfm_retention_policy_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_clients_near_retention_expiry(
  p_tenant_id UUID,
  p_months_ahead INTEGER DEFAULT 12
) RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  cpf TEXT,
  last_appointment DATE,
  retention_expires DATE,
  days_until_expiry INTEGER,
  total_records BIGINT,
  total_prescriptions BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.cpf,
    c.last_appointment_date as last_appointment,
    c.retention_expires_at as retention_expires,
    (c.retention_expires_at - CURRENT_DATE)::INTEGER as days_until_expiry,
    (SELECT COUNT(*) FROM medical_records mr WHERE mr.client_id = c.id) as total_records,
    (SELECT COUNT(*) FROM prescriptions p 
     JOIN medical_records mr ON mr.id = p.medical_record_id 
     WHERE mr.client_id = c.id) as total_prescriptions
  FROM clients c
  WHERE c.tenant_id = p_tenant_id
    AND c.retention_expires_at IS NOT NULL
    AND c.retention_expires_at <= CURRENT_DATE + (p_months_ahead || ' months')::INTERVAL
    AND c.retention_expires_at >= CURRENT_DATE
  ORDER BY c.retention_expires_at ASC;
END;
$$;


-- ============================================
-- Function: get_retention_deletion_attempts
-- Source: 20260324700000_cfm_retention_policy_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_retention_deletion_attempts(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  attempted_at TIMESTAMPTZ,
  user_email TEXT,
  table_name TEXT,
  client_name TEXT,
  retention_expires DATE,
  reason TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rda.id,
    rda.attempted_at,
    COALESCE(up.email, 'Sistema') as user_email,
    rda.table_name,
    rda.client_name,
    rda.retention_expires_at as retention_expires,
    rda.reason
  FROM retention_deletion_attempts rda
  LEFT JOIN profiles up ON up.user_id = rda.user_id
  WHERE rda.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR rda.attempted_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR rda.attempted_at::DATE <= p_end_date)
  ORDER BY rda.attempted_at DESC;
END;
$$;


-- ============================================
-- Function: get_retention_statistics
-- Source: 20260324700000_cfm_retention_policy_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_retention_statistics(p_tenant_id UUID)
RETURNS TABLE (
  total_clients BIGINT,
  clients_with_retention BIGINT,
  expiring_this_year BIGINT,
  expiring_next_year BIGINT,
  already_archived BIGINT,
  deletion_attempts_blocked BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id) as total_clients,
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id AND retention_expires_at IS NOT NULL) as clients_with_retention,
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id 
     AND retention_expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 year') as expiring_this_year,
    (SELECT COUNT(*) FROM clients WHERE tenant_id = p_tenant_id 
     AND retention_expires_at BETWEEN CURRENT_DATE + INTERVAL '1 year' AND CURRENT_DATE + INTERVAL '2 years') as expiring_next_year,
    (SELECT COUNT(*) FROM archived_clinical_data WHERE tenant_id = p_tenant_id) as already_archived,
    (SELECT COUNT(*) FROM retention_deletion_attempts WHERE tenant_id = p_tenant_id AND blocked = true) as deletion_attempts_blocked;
END;
$$;


-- ============================================
-- Function: trg_sngpc_updated_at
-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
-- ============================================
CREATE OR REPLACE FUNCTION trg_sngpc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

