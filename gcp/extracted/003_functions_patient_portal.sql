-- GCP Migration: Functions - patient_portal
-- Total: 50 functions


-- ============================================
-- Function: link_patient_to_clinic
-- Source: 20260320000000_patient_portal_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.link_patient_to_clinic(
  p_patient_user_id uuid,
  p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_profile public.profiles%rowtype;
  v_client public.clients%rowtype;
  v_existing public.patient_profiles%rowtype;
  v_result public.patient_profiles%rowtype;
BEGIN
  -- Validate caller is staff
  SELECT * INTO v_caller_profile FROM public.profiles WHERE user_id = v_caller_id LIMIT 1;
  IF v_caller_profile IS NULL THEN
    RAISE EXCEPTION 'NOT_STAFF' USING DETAIL = 'Caller has no profile';
  END IF;

  -- Validate client belongs to caller's tenant
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND tenant_id = v_caller_profile.tenant_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'CLIENT_NOT_FOUND' USING DETAIL = 'Client not found in your tenant';
  END IF;

  -- Check if already linked
  SELECT * INTO v_existing FROM public.patient_profiles
    WHERE user_id = p_patient_user_id AND tenant_id = v_caller_profile.tenant_id;

  IF v_existing IS NOT NULL THEN
    -- Update existing link
    UPDATE public.patient_profiles
      SET client_id = p_client_id, is_active = true, updated_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
      VALUES (p_patient_user_id, v_caller_profile.tenant_id, p_client_id)
      RETURNING * INTO v_result;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'patient_profile_id', v_result.id,
    'client_id', v_result.client_id
  );
END;
$$;


-- ============================================
-- Function: validate_patient_access
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_patient_access(
  p_identifier TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_identifier TEXT := btrim(upper(p_identifier));
  v_cpf_clean TEXT;
  v_status TEXT;
BEGIN
  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Identificador não informado');
  END IF;

  SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE upper(p.access_code) = v_identifier
  LIMIT 1;

  IF v_patient IS NULL THEN
    v_cpf_clean := regexp_replace(p_identifier, '[^0-9]', '', 'g');
    IF length(v_cpf_clean) >= 11 THEN
      SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
             t.name AS clinic_name
      INTO v_patient
      FROM public.patients p
      LEFT JOIN public.tenants t ON t.id = p.tenant_id
      WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = v_cpf_clean
      LIMIT 1;
    END IF;
  END IF;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_patient.user_id IS NOT NULL THEN v_status := 'has_account';
  ELSE v_status := 'new';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_status,
    'patient_id', v_patient.id,
    'client_id', v_patient.id,
    'client_name', v_patient.name,
    'client_email', v_patient.email,
    'clinic_name', v_patient.clinic_name,
    'masked_email', CASE
      WHEN v_patient.email IS NOT NULL AND v_patient.email <> '' THEN
        substr(v_patient.email, 1, 2) || '***@' || split_part(v_patient.email, '@', 2)
      ELSE NULL
    END
  );
END;
$$;


-- ============================================
-- Function: activate_patient_account
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.activate_patient_account(
  p_client_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_pp_id UUID;
BEGIN
  SELECT id, tenant_id, name, user_id INTO v_patient
  FROM public.patients WHERE id = p_client_id;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLIENT_NOT_FOUND');
  END IF;
  IF v_patient.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ACTIVATED');
  END IF;

  UPDATE public.patients SET user_id = p_user_id, updated_at = now() WHERE id = p_client_id;

  INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
  VALUES (p_user_id, v_patient.tenant_id, p_client_id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, is_active = true, updated_at = now()
  RETURNING id INTO v_pp_id;

  RETURN jsonb_build_object('success', true, 'patient_profile_id', v_pp_id, 'client_name', v_patient.name);
END;
$$;


-- ============================================
-- Function: notify_patient
-- Source: 20260703200000_fix_all_client_id_triggers_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient record;
  v_type text;
  v_title text;
  v_body text;
  v_prof_name text;
  v_clinic_name text;
  v_metadata jsonb;
BEGIN
  -- Buscar todos os pacientes vinculados a este patient_id + tenant_id
  -- NOTA: patient_profiles.client_id continua com esse nome (bridge table)
  FOR v_patient IN
    SELECT pp.user_id
    FROM public.patient_profiles pp
    WHERE pp.client_id = NEW.patient_id
      AND pp.tenant_id = NEW.tenant_id
      AND pp.is_active = true
  LOOP
    v_prof_name := '';
    IF TG_TABLE_NAME = 'exam_results' THEN
      SELECT COALESCE(p.full_name, '') INTO v_prof_name
      FROM public.profiles p WHERE p.id = NEW.requested_by;
    ELSE
      SELECT COALESCE(p.full_name, '') INTO v_prof_name
      FROM public.profiles p WHERE p.id = NEW.professional_id;
    END IF;

    SELECT COALESCE(t.name, '') INTO v_clinic_name
    FROM public.tenants t WHERE t.id = NEW.tenant_id;

    IF TG_TABLE_NAME = 'medical_certificates' THEN
      v_type := 'certificate_released';
      v_title := 'Novo atestado disponível';
      v_body := format('O Dr(a). %s emitiu um %s para você.',
        v_prof_name,
        CASE NEW.certificate_type
          WHEN 'atestado' THEN 'atestado médico'
          WHEN 'declaracao_comparecimento' THEN 'declaração de comparecimento'
          WHEN 'laudo' THEN 'laudo médico'
          WHEN 'relatorio' THEN 'relatório médico'
          ELSE 'documento médico'
        END
      );
      v_metadata := jsonb_build_object(
        'certificate_id', NEW.id,
        'certificate_type', NEW.certificate_type,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );

    ELSIF TG_TABLE_NAME = 'prescriptions' THEN
      v_type := 'prescription_released';
      v_title := 'Nova receita disponível';
      v_body := format('O Dr(a). %s emitiu uma receita %s para você.',
        v_prof_name,
        CASE NEW.prescription_type
          WHEN 'simples' THEN 'simples'
          WHEN 'especial_b' THEN 'especial B'
          WHEN 'especial_a' THEN 'especial A'
          WHEN 'antimicrobiano' THEN 'de antimicrobiano'
          ELSE ''
        END
      );
      v_metadata := jsonb_build_object(
        'prescription_id', NEW.id,
        'prescription_type', NEW.prescription_type,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );

    ELSIF TG_TABLE_NAME = 'exam_results' THEN
      v_type := 'exam_released';
      v_title := 'Novo resultado de exame disponível';
      v_body := format('O resultado do exame "%s" já está disponível.', COALESCE(NEW.exam_name, 'Exame'));
      v_metadata := jsonb_build_object(
        'exam_id', NEW.id,
        'exam_name', NEW.exam_name,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );
    END IF;

    INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)
    VALUES (v_patient.user_id, v_type, v_title, v_body, v_metadata);
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: start_patient_service
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.start_patient_service(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls SET
    status = 'in_service',
    started_service_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id AND status = 'calling';
END;
$$;


-- ============================================
-- Function: complete_patient_service
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_patient_service(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_triage_id UUID;
BEGIN
  UPDATE patient_calls SET 
    status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_call_id
  RETURNING triage_id INTO v_triage_id;

  IF v_triage_id IS NOT NULL THEN
    UPDATE triage_records SET status = 'concluida'
    WHERE id = v_triage_id AND status != 'concluida';
  END IF;
END;
$$;


-- ============================================
-- Function: mark_patient_no_show
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_patient_no_show(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls SET
    status = 'no_show', updated_at = NOW()
  WHERE id = p_call_id AND status IN ('waiting', 'calling');
END;
$$;


-- ============================================
-- Function: get_patient_credits_history
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_credits_history(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  type text,
  amount integer,
  balance_after integer,
  reason text,
  reference_type text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id,
    t.type,
    t.amount,
    t.balance_after,
    t.reason,
    t.reference_type,
    t.created_at,
    t.expires_at
  FROM public.health_credits_transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.patient_id = p_patient_id
    AND p_tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ORDER BY t.created_at DESC
  LIMIT p_limit;
$$;


-- ============================================
-- Function: get_patient_all_consents
-- Source: 20260722000000_fix_consent_rpcs_client_id_to_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_all_consents(p_patient_id uuid)
RETURNS TABLE (
  template_id        uuid,
  title              text,
  body_html          text,
  is_required        boolean,
  template_type      text,
  sort_order         int,
  consent_id         uuid,
  signed_at          timestamptz,
  signature_method   text,
  sealed_pdf_path    text,
  is_signed          boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ct.id            AS template_id,
    ct.title,
    ct.body_html,
    ct.is_required,
    ct.template_type,
    ct.sort_order,
    pc.id            AS consent_id,
    pc.signed_at,
    pc.signature_method,
    pc.sealed_pdf_path,
    (pc.signature_method IS NOT NULL) AS is_signed
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
  LEFT JOIN public.patient_consents pc
    ON pc.template_id = ct.id
    AND pc.patient_id = p_patient_id
  WHERE c.id = p_patient_id
    AND ct.is_active = true
  ORDER BY
    (pc.signature_method IS NULL) DESC,   -- pendentes primeiro
    ct.is_required DESC,
    ct.sort_order,
    ct.created_at;
$$;


-- ============================================
-- Function: notify_patient_consent
-- Source: 20260325180000_consent_patient_notifications.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_patient_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_type        text;
  v_title       text;
  v_body        text;
  v_template    text;
  v_clinic_name text;
  v_metadata    jsonb;
BEGIN
  -- ── Resolve user_id do paciente ──
  -- Preferir patient_user_id (auth.uid) quando disponível
  v_user_id := NEW.patient_user_id;

  -- Se não tiver, buscar via patient_profiles
  IF v_user_id IS NULL THEN
    SELECT pp.user_id INTO v_user_id
    FROM public.patient_profiles pp
    WHERE pp.client_id = NEW.patient_id
      AND pp.tenant_id = NEW.tenant_id
      AND pp.is_active = true
    LIMIT 1;
  END IF;

  -- Sem user_id = sem notificação (paciente sem login)
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Buscar título do template ──
  SELECT COALESCE(ct.title, 'Documento') INTO v_template
  FROM public.consent_templates ct
  WHERE ct.id = NEW.template_id;

  -- ── Buscar nome da clínica ──
  SELECT COALESCE(t.name, '') INTO v_clinic_name
  FROM public.tenants t WHERE t.id = NEW.tenant_id;

  -- ═══ Lógica de INSERT ═══
  IF TG_OP = 'INSERT' THEN
    IF NEW.signed_at IS NOT NULL THEN
      -- Assinado no momento da criação (assinatura direta)
      v_type  := 'consent_signed';
      v_title := 'Documento assinado ✅';
      v_body  := format('O termo "%s" foi assinado com sucesso.', v_template);
      v_metadata := jsonb_build_object(
        'consent_id', NEW.id,
        'template_id', NEW.template_id,
        'template_title', v_template,
        'clinic_name', v_clinic_name,
        'signed_at', NEW.signed_at
      );
    ELSE
      -- Criado pendente (ex: auto-geração por plano de tratamento)
      v_type  := 'consent_pending';
      v_title := 'Novo documento para assinar 📋';
      v_body  := format('O termo "%s" está aguardando sua assinatura.', v_template);
      v_metadata := jsonb_build_object(
        'consent_id', NEW.id,
        'template_id', NEW.template_id,
        'template_title', v_template,
        'clinic_name', v_clinic_name
      );
    END IF;

  -- ═══ Lógica de UPDATE ═══
  ELSIF TG_OP = 'UPDATE' THEN
    -- Apenas notifica quando signed_at muda de NULL para NOT NULL
    IF OLD.signed_at IS NULL AND NEW.signed_at IS NOT NULL THEN
      v_type  := 'consent_signed';
      v_title := 'Documento assinado ✅';
      v_body  := format('O termo "%s" foi assinado com sucesso.', v_template);
      v_metadata := jsonb_build_object(
        'consent_id', NEW.id,
        'template_id', NEW.template_id,
        'template_title', v_template,
        'clinic_name', v_clinic_name,
        'signed_at', NEW.signed_at
      );
    ELSE
      -- Nenhuma mudança relevante → sai sem notificar
      RETURN NEW;
    END IF;
  END IF;

  -- ── Inserir notificação ──
  INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)
  VALUES (v_user_id, v_type, v_title, v_body, v_metadata);

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_patient_bookable_services
-- Source: APLICAR_MIGRATION_700000_800000.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_bookable_services()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  duration_minutes integer,
  price numeric,
  category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = v_tenant_id AND t.patient_booking_enabled = true
  ) THEN
    RAISE EXCEPTION 'Agendamento online não está habilitado para esta clínica';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.description,
    s.duration_minutes,
    s.price,
    COALESCE(s.procedure_type, s.name)::text AS category
  FROM public.procedures s
  WHERE s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.patient_bookable = true
  ORDER BY s.name;
END;
$$;


-- ============================================
-- Function: get_patient_bookable_professionals
-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_bookable_professionals(p_service_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  professional_type text,
  council_type text,
  council_number text,
  council_state text,
  avg_rating numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.professional_type::text,
    p.council_type,
    p.council_number,
    p.council_state,
    COALESCE(
      (SELECT AVG(ar.rating)::numeric(3,2)
       FROM public.appointment_ratings ar
       JOIN public.appointments a ON a.id = ar.appointment_id
       WHERE a.professional_id = p.id),
      0
    ) as avg_rating
  FROM public.profiles p
  WHERE p.tenant_id = v_tenant_id
    AND p.patient_bookable = true
  ORDER BY p.full_name;
END;
$$;


-- ============================================
-- Function: get_patient_booking_settings
-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_booking_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_tenant public.tenants%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'not_linked');
  END IF;

  SELECT * INTO v_tenant FROM public.tenants t WHERE t.id = v_tenant_id;

  RETURN jsonb_build_object(
    'enabled', v_tenant.patient_booking_enabled,
    'min_hours_advance', v_tenant.patient_booking_min_hours_advance,
    'max_days_advance', v_tenant.patient_booking_max_days_advance,
    'max_pending', v_tenant.patient_booking_max_pending_per_patient,
    'clinic_name', v_tenant.name
  );
END;
$$;


-- ============================================
-- Function: get_patient_financial_summary
-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_total_pending numeric;
  v_total_overdue numeric;
  v_next_due_date date;
  v_next_due_amount numeric;
  v_last_payment_date timestamptz;
  v_last_payment_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_linked');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pending
  FROM public.patient_invoices WHERE client_id = v_client_id AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_overdue
  FROM public.patient_invoices WHERE client_id = v_client_id AND status = 'overdue';

  SELECT due_date, amount INTO v_next_due_date, v_next_due_amount
  FROM public.patient_invoices
  WHERE client_id = v_client_id AND status IN ('pending', 'overdue')
  ORDER BY due_date ASC LIMIT 1;

  SELECT pp.paid_at, pp.amount INTO v_last_payment_date, v_last_payment_amount
  FROM public.patient_payments pp
  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id
  WHERE pi.client_id = v_client_id AND pp.status = 'completed'
  ORDER BY pp.paid_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'total_pending', v_total_pending,
    'total_overdue', v_total_overdue,
    'total_due', v_total_pending + v_total_overdue,
    'next_due_date', v_next_due_date,
    'next_due_amount', v_next_due_amount,
    'last_payment_date', v_last_payment_date,
    'last_payment_amount', v_last_payment_amount
  );
END;
$$;


-- ============================================
-- Function: get_patient_invoices
-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_invoices(
  p_status text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, description text, amount numeric, due_date date, status text,
  paid_at timestamptz, paid_amount numeric, payment_method text,
  payment_url text, appointment_id uuid, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT pi.id, pi.description, pi.amount, pi.due_date, pi.status,
    pi.paid_at, pi.paid_amount, pi.payment_method, pi.payment_url,
    pi.appointment_id, pi.created_at
  FROM public.patient_invoices pi
  WHERE pi.client_id = v_client_id
    AND (p_status IS NULL OR pi.status = p_status)
    AND (p_from IS NULL OR pi.due_date >= p_from)
    AND (p_to IS NULL OR pi.due_date <= p_to)
  ORDER BY CASE WHEN pi.status IN ('pending', 'overdue') THEN 0 ELSE 1 END, pi.due_date DESC;
END;
$$;


-- ============================================
-- Function: send_patient_message
-- Source: 20260326600000_patient_portal_fix_queries_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.send_patient_message(p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_client_name text;
  v_message_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_content IS NULL OR BTRIM(p_content) = '' THEN RAISE EXCEPTION 'Mensagem não pode estar vazia'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = v_client_id;

  INSERT INTO public.patient_messages (tenant_id, client_id, sender_type, sender_user_id, sender_name, content)
  VALUES (v_tenant_id, v_client_id, 'patient', v_user_id, v_client_name, BTRIM(p_content))
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_message_id);
END;
$$;


-- ============================================
-- Function: get_patient_messages
-- Source: 20260326600000_patient_portal_fix_queries_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_messages(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, sender_type text, sender_name text, content text, read_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  -- Marcar mensagens da clínica como lidas
  UPDATE public.patient_messages pm
  SET read_at = now()
  WHERE pm.client_id = v_client_id AND pm.sender_type = 'clinic' AND pm.read_at IS NULL;

  RETURN QUERY
  SELECT pm.id, pm.sender_type, pm.sender_name, pm.content, pm.read_at, pm.created_at
  FROM public.patient_messages pm
  WHERE pm.client_id = v_client_id
  ORDER BY pm.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ============================================
-- Function: get_patient_unread_messages_count
-- Source: 20260326600000_patient_portal_fix_queries_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_unread_messages_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.patient_messages pm
  WHERE pm.client_id = v_client_id AND pm.sender_type = 'clinic' AND pm.read_at IS NULL;

  RETURN v_count;
END;
$$;


-- ============================================
-- Function: get_patient_conversations
-- Source: 20260326200001_fix_patient_messages_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_conversations()
RETURNS TABLE (
  patient_id uuid,
  client_name text,
  last_message text,
  last_message_at timestamptz,
  last_sender_type text,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT p.tenant_id INTO v_tenant_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a tenant';
  END IF;

  RETURN QUERY
  WITH last_messages AS (
    SELECT DISTINCT ON (pm.patient_id)
      pm.patient_id,
      pm.content as last_message,
      pm.created_at as last_message_at,
      pm.sender_type as last_sender_type
    FROM public.patient_messages pm
    WHERE pm.tenant_id = v_tenant_id
    ORDER BY pm.patient_id, pm.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      pm.patient_id,
      COUNT(*) as unread_count
    FROM public.patient_messages pm
    WHERE pm.tenant_id = v_tenant_id
      AND pm.sender_type = 'patient'
      AND pm.read_at IS NULL
    GROUP BY pm.patient_id
  )
  SELECT 
    c.id as patient_id,
    c.name as client_name,
    lm.last_message,
    lm.last_message_at,
    lm.last_sender_type,
    COALESCE(uc.unread_count, 0) as unread_count
  FROM public.clients c
  JOIN last_messages lm ON lm.patient_id = c.id
  LEFT JOIN unread_counts uc ON uc.patient_id = c.id
  WHERE c.tenant_id = v_tenant_id
  ORDER BY lm.last_message_at DESC;
END;
$$;


-- ============================================
-- Function: get_patient_health_timeline
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_health_timeline(p_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, event_type text, event_date timestamptz, title text, description text, professional_name text, metadata jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client_id uuid; v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT a.id, 'appointment'::text, a.scheduled_at, COALESCE(s.name,'Consulta')::text, COALESCE(a.notes,'')::text, COALESCE(p.full_name,'')::text, jsonb_build_object('status',a.status,'procedure_id',a.procedure_id)
  FROM public.appointments a LEFT JOIN public.procedures s ON s.id=a.procedure_id LEFT JOIN public.profiles p ON p.id=a.professional_id
  WHERE a.patient_id=v_client_id AND a.tenant_id=v_tenant_id AND a.status='completed'
  UNION ALL
  SELECT pr.id, 'prescription'::text, pr.created_at, ('Receita '||COALESCE(pr.prescription_type,'simples'))::text, LEFT(COALESCE(pr.medications,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('type',pr.prescription_type,'status',pr.status)
  FROM public.prescriptions pr LEFT JOIN public.profiles prof ON prof.id=pr.professional_id WHERE pr.patient_id=v_client_id AND pr.tenant_id=v_tenant_id
  UNION ALL
  SELECT er.id, 'exam'::text, er.created_at, COALESCE(er.exam_name,'Exame')::text, COALESCE(er.result_text,'')::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('status',er.status,'priority',er.priority)
  FROM public.exam_results er LEFT JOIN public.profiles prof ON prof.id=er.requested_by WHERE er.patient_id=v_client_id AND er.tenant_id=v_tenant_id
  UNION ALL
  SELECT mc.id, 'certificate'::text, mc.issued_at, CASE mc.certificate_type WHEN 'atestado' THEN 'Atestado Médico' WHEN 'declaracao_comparecimento' THEN 'Declaração de Comparecimento' WHEN 'laudo' THEN 'Laudo' WHEN 'relatorio' THEN 'Relatório' ELSE 'Atestado' END::text, LEFT(COALESCE(mc.content,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('type',mc.certificate_type,'days_off',mc.days_off,'cid_code',mc.cid_code)
  FROM public.medical_certificates mc LEFT JOIN public.profiles prof ON prof.id=mc.professional_id WHERE mc.patient_id=v_client_id AND mc.tenant_id=v_tenant_id
  UNION ALL
  SELECT mr.id, 'medical_report'::text, mr.created_at, CASE mr.tipo WHEN 'medico' THEN 'Laudo Médico' WHEN 'pericial' THEN 'Laudo Pericial' WHEN 'aptidao' THEN 'Atestado de Aptidão' WHEN 'capacidade' THEN 'Laudo de Capacidade' WHEN 'complementar' THEN 'Laudo Complementar' WHEN 'psicologico' THEN 'Laudo Psicológico' WHEN 'neuropsicologico' THEN 'Avaliação Neuropsicológica' WHEN 'ocupacional' THEN 'Laudo Ocupacional' ELSE 'Laudo' END::text, LEFT(COALESCE(mr.conclusao,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('tipo',mr.tipo,'status',mr.status,'cid10',mr.cid10)
  FROM public.medical_reports mr LEFT JOIN public.profiles prof ON prof.id=mr.professional_id WHERE mr.patient_id=v_client_id AND mr.tenant_id=v_tenant_id AND mr.status IN ('finalizado','assinado')
  UNION ALL
  SELECT rf.id, 'referral'::text, rf.created_at, ('Encaminhamento — '||COALESCE(sp.name,'Especialista'))::text, LEFT(COALESCE(rf.reason,''),200)::text, COALESCE(from_prof.full_name,'')::text, jsonb_build_object('status',rf.status,'priority',rf.priority)
  FROM public.referrals rf LEFT JOIN public.profiles from_prof ON from_prof.id=rf.from_professional LEFT JOIN public.specialties sp ON sp.id=rf.to_specialty_id WHERE rf.patient_id=v_client_id AND rf.tenant_id=v_tenant_id
  ORDER BY event_date DESC LIMIT p_limit;
END;
$$;


-- ============================================
-- Function: get_patient_active_medications
-- Source: 20260724500000_fix_patient_saude_rpcs_v4.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_active_medications()
RETURNS TABLE (
  id                uuid,
  medication_name   text,
  dosage            text,
  prescription_date timestamptz,
  expiry_date       date,
  professional_name text,
  is_expired        boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT
    pr.id,
    LEFT(COALESCE(pr.medications, 'Medicamento'), 150)             AS medication_name,
    ''::text                                                        AS dosage,
    pr.issued_at                                                    AS prescription_date,
    COALESCE(
      pr.expires_at::date,
      (pr.issued_at + (COALESCE(pr.validity_days, 30) * INTERVAL '1 day'))::date
    )                                                               AS expiry_date,
    COALESCE(prof.full_name, '')                                    AS professional_name,
    COALESCE(
      pr.expires_at::date,
      (pr.issued_at + (COALESCE(pr.validity_days, 30) * INTERVAL '1 day'))::date
    ) < CURRENT_DATE                                                AS is_expired
  FROM public.prescriptions pr
  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id
  WHERE pr.patient_id = v_client_id
    AND pr.tenant_id  = v_tenant_id
    AND pr.issued_at  > now() - INTERVAL '180 days'
  ORDER BY pr.issued_at DESC;
END;
$$;


-- ============================================
-- Function: get_patient_health_info
-- Source: 20260724500000_fix_patient_saude_rpcs_v4.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_health_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_patient     public.patients%ROWTYPE;
  v_vital_signs jsonb;
  v_allergies   text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  SELECT * INTO v_patient FROM public.patients WHERE id = v_client_id;

  -- Últimos sinais vitais registrados na triagem
  SELECT jsonb_build_object(
    'weight',            tr.weight_kg,
    'height',            tr.height_cm,
    'blood_pressure',    CASE
                           WHEN tr.blood_pressure_systolic IS NOT NULL
                            AND tr.blood_pressure_diastolic IS NOT NULL
                           THEN tr.blood_pressure_systolic::text || '/' || tr.blood_pressure_diastolic::text
                           ELSE NULL
                         END,
    'heart_rate',        tr.heart_rate,
    'temperature',       tr.temperature,
    'oxygen_saturation', tr.oxygen_saturation,
    'recorded_at',       tr.triaged_at
  ) INTO v_vital_signs
  FROM public.triage_records tr
  WHERE tr.patient_id = v_client_id
    AND (tr.weight_kg IS NOT NULL OR tr.blood_pressure_systolic IS NOT NULL)
  ORDER BY tr.triaged_at DESC
  LIMIT 1;

  -- Alergias anotadas na triagem mais recente
  SELECT tr.allergies INTO v_allergies
  FROM public.triage_records tr
  WHERE tr.patient_id = v_client_id
    AND tr.allergies IS NOT NULL
    AND tr.allergies <> ''
  ORDER BY tr.triaged_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'allergies',       v_allergies,
    'blood_type',      v_patient.blood_type,
    'birth_date',      v_patient.birth_date,
    'gender',          v_patient.gender,
    'last_vital_signs', COALESCE(v_vital_signs, '{}'::jsonb)
  );
END;
$$;


-- ============================================
-- Function: update_patient_onboarding
-- Source: 20260326400000_patient_portal_engagement_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_patient_onboarding(
  p_tour_completed boolean DEFAULT NULL,
  p_tour_skipped boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_onboarding public.patient_onboarding%ROWTYPE;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Upsert onboarding record
  INSERT INTO public.patient_onboarding (patient_user_id, last_login_at, login_count)
  VALUES (v_patient_user_id, now(), 1)
  ON CONFLICT (patient_user_id) DO UPDATE SET
    last_login_at = now(),
    login_count = patient_onboarding.login_count + 1,
    tour_completed = COALESCE(p_tour_completed, patient_onboarding.tour_completed),
    tour_completed_at = CASE WHEN p_tour_completed = true THEN now() ELSE patient_onboarding.tour_completed_at END,
    tour_skipped = COALESCE(p_tour_skipped, patient_onboarding.tour_skipped)
  RETURNING * INTO v_onboarding;

  RETURN jsonb_build_object(
    'tour_completed', v_onboarding.tour_completed,
    'tour_skipped', v_onboarding.tour_skipped,
    'login_count', v_onboarding.login_count,
    'first_login_at', v_onboarding.first_login_at
  );
END;
$$;


-- ============================================
-- Function: get_patient_onboarding_status
-- Source: 20260326400000_patient_portal_engagement_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_onboarding_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_onboarding public.patient_onboarding%ROWTYPE;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('is_new', true);
  END IF;

  SELECT * INTO v_onboarding
  FROM public.patient_onboarding
  WHERE patient_user_id = v_patient_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_new', true, 'show_tour', true);
  END IF;

  RETURN jsonb_build_object(
    'is_new', false,
    'show_tour', NOT v_onboarding.tour_completed AND NOT v_onboarding.tour_skipped,
    'tour_completed', v_onboarding.tour_completed,
    'login_count', v_onboarding.login_count
  );
END;
$$;


-- ============================================
-- Function: get_patient_dependents
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_dependents()
RETURNS TABLE (dependent_id uuid, dependent_name text, relationship text, email text, phone text, birth_date date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_patient_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT pp.client_id INTO v_patient_id FROM public.patient_profiles pp WHERE pp.user_id=auth.uid() AND pp.is_active=true LIMIT 1;
  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT pd.id AS dependent_id, p.name AS dependent_name, pd.relationship, p.email, p.phone, p.date_of_birth AS birth_date
  FROM public.patient_dependents pd JOIN public.patients p ON p.id=pd.dependent_patient_id
  WHERE pd.parent_patient_id=v_patient_id AND pd.is_active=true ORDER BY p.name;
END;
$$;


-- ============================================
-- Function: get_patient_achievements
-- Source: 20260326400000_patient_portal_engagement_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_achievements()
RETURNS TABLE (
  achievement_type text,
  achievement_name text,
  achieved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  RETURN QUERY
  SELECT 
    pa.achievement_type,
    pa.achievement_name,
    pa.achieved_at
  FROM public.patient_achievements pa
  WHERE pa.patient_user_id = v_patient_user_id
  ORDER BY pa.achieved_at DESC;
END;
$$;


-- ============================================
-- Function: check_patient_achievements
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.check_patient_achievements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid; v_client_id uuid; v_tenant_id uuid; v_new text[]:='{}'; v_appt int; v_rat int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('new_achievements',v_new); END IF;
  SELECT pp.client_id,pp.tenant_id INTO v_client_id,v_tenant_id FROM public.patient_profiles pp WHERE pp.user_id=v_user_id AND pp.is_active=true LIMIT 1;
  IF v_client_id IS NULL THEN RETURN jsonb_build_object('new_achievements',v_new); END IF;

  SELECT COUNT(*) INTO v_appt FROM public.appointments WHERE patient_id=v_client_id AND status='completed';
  IF v_appt>=1 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'first_appointment','Primeira Consulta') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Primeira Consulta'); END IF; END IF;
  IF v_appt>=5 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'five_appointments','Paciente Frequente') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Paciente Frequente'); END IF; END IF;
  IF v_appt>=10 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'ten_appointments','Paciente Fiel') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Paciente Fiel'); END IF; END IF;
  SELECT COUNT(*) INTO v_rat FROM public.appointment_ratings WHERE patient_user_id=v_user_id;
  IF v_rat>=1 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'first_rating','Avaliador') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Avaliador'); END IF; END IF;
  RETURN jsonb_build_object('new_achievements',v_new);
END;
$$;


-- ============================================
-- Function: get_patient_pending_ratings
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_pending_ratings()
RETURNS TABLE (appointment_id uuid, scheduled_at timestamptz, completed_at timestamptz, service_name text, professional_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT pp.client_id INTO v_client_id FROM public.patient_profiles pp WHERE pp.user_id=auth.uid() AND pp.is_active=true LIMIT 1;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT a.id, a.scheduled_at, a.updated_at AS completed_at, COALESCE(s.name,'Consulta')::text, COALESCE(p.full_name,'')::text
  FROM public.appointments a
  LEFT JOIN public.procedures s ON s.id=a.procedure_id
  LEFT JOIN public.profiles p ON p.id=a.professional_id
  WHERE a.patient_id=v_client_id AND a.status='completed' AND a.scheduled_at > now()-interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.appointment_ratings ar WHERE ar.appointment_id=a.id)
  ORDER BY a.scheduled_at DESC LIMIT 5;
END;
$$;


-- ============================================
-- Function: get_patient_link
-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_link()
RETURNS TABLE (client_id uuid, tenant_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pp.client_id, pp.tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid()
    AND pp.is_active = true
  LIMIT 1;
END;
$$;


-- ============================================
-- Function: add_patient_dependent
-- Source: 20260701100000_fix_dependents_renamed_columns_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.add_patient_dependent(
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_relationship text DEFAULT 'outro'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_parent_patient_id uuid;
  v_tenant_id uuid;
  v_new_patient_id uuid;
  v_dependent_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_parent_patient_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_parent_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cadastro de paciente não encontrado');
  END IF;

  IF p_relationship NOT IN ('filho', 'filha', 'pai', 'mae', 'conjuge', 'outro') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tipo de parentesco inválido');
  END IF;

  INSERT INTO public.patients (
    tenant_id, name, email, phone, birth_date, is_dependent, created_by_patient
  ) VALUES (
    v_tenant_id, p_name, p_email, p_phone, p_birth_date, true, true
  )
  RETURNING id INTO v_new_patient_id;

  INSERT INTO public.patient_dependents (
    tenant_id, parent_patient_id, dependent_patient_id, relationship
  ) VALUES (
    v_tenant_id, v_parent_patient_id, v_new_patient_id, p_relationship
  )
  RETURNING id INTO v_dependent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Dependente adicionado com sucesso',
    'dependent_id', v_new_patient_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- ============================================
-- Function: remove_patient_dependent
-- Source: 20260701100000_fix_dependents_renamed_columns_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.remove_patient_dependent(
  p_dependent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_parent_patient_id uuid;
  v_relationship_exists boolean;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  SELECT pp.client_id INTO v_parent_patient_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_parent_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cadastro de paciente não encontrado');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.patient_dependents pd
    WHERE pd.parent_patient_id = v_parent_patient_id
    AND pd.dependent_patient_id = p_dependent_id
  ) INTO v_relationship_exists;

  IF NOT v_relationship_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dependente não encontrado');
  END IF;

  UPDATE public.patient_dependents
  SET is_active = false, updated_at = now()
  WHERE parent_patient_id = v_parent_patient_id
  AND dependent_patient_id = p_dependent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Dependente removido com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- ============================================
-- Function: get_patient_dashboard_summary
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid; v_tenant_id uuid; v_clinic_name text;
  v_upcoming_appointments jsonb; v_upcoming_teleconsultas jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('is_linked', false, 'clinic_name', null, 'upcoming_appointments', '[]'::jsonb, 'upcoming_teleconsultas', '[]'::jsonb);
  END IF;

  SELECT pp.client_id, pp.tenant_id, t.name INTO v_client_id, v_tenant_id, v_clinic_name
  FROM public.patient_profiles pp JOIN public.tenants t ON t.id = pp.tenant_id
  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('is_linked', false, 'clinic_name', null, 'upcoming_appointments', '[]'::jsonb, 'upcoming_teleconsultas', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb) INTO v_upcoming_appointments
  FROM (
    SELECT a.id, a.scheduled_at, s.name AS service_name, p.full_name AS professional_name, t.name AS clinic_name, a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending','confirmed') AND a.scheduled_at > now()
      AND (a.telemedicine IS NULL OR a.telemedicine = false)
    ORDER BY a.scheduled_at LIMIT 5
  ) r;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb) INTO v_upcoming_teleconsultas
  FROM (
    SELECT a.id, a.scheduled_at, s.name AS service_name, p.full_name AS professional_name, t.name AS clinic_name, a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending','confirmed') AND a.scheduled_at > now() AND a.telemedicine = true
    ORDER BY a.scheduled_at LIMIT 3
  ) r;

  RETURN jsonb_build_object('is_linked', true, 'clinic_name', v_clinic_name, 'upcoming_appointments', v_upcoming_appointments, 'upcoming_teleconsultas', v_upcoming_teleconsultas);
END;
$$;


-- ============================================
-- Function: get_patient_priority
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE FUNCTION public.get_patient_priority(p_patient_id UUID)
RETURNS TABLE (priority INTEGER, priority_label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_birth_date DATE;
  v_age INTEGER;
  v_is_pregnant BOOLEAN;
  v_is_pcd BOOLEAN;
BEGIN
  SELECT 
    COALESCE(c.date_of_birth, c.birth_date),
    LOWER(COALESCE(c.notes, '')) LIKE '%gestante%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%grávida%'
      OR LOWER(COALESCE(c.notes, '')) LIKE '%gravida%',
    LOWER(COALESCE(c.notes, '')) LIKE '%pcd%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiente%' 
      OR LOWER(COALESCE(c.notes, '')) LIKE '%cadeirante%'
      OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiência%'
  INTO v_birth_date, v_is_pregnant, v_is_pcd
  FROM patients c
  WHERE c.id = p_patient_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 5, 'Normal'::TEXT;
    RETURN;
  END IF;
  
  IF v_birth_date IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_birth_date));
  END IF;
  
  -- Prioridades (Estatuto do Idoso / Lei 10.048):
  IF v_age IS NOT NULL AND v_age >= 80 THEN
    RETURN QUERY SELECT 2, 'Idoso 80+'::TEXT;
  ELSIF v_is_pregnant THEN
    RETURN QUERY SELECT 2, 'Gestante'::TEXT;
  ELSIF v_is_pcd THEN
    RETURN QUERY SELECT 2, 'PCD'::TEXT;
  ELSIF v_age IS NOT NULL AND v_age >= 60 THEN
    RETURN QUERY SELECT 3, 'Idoso 60+'::TEXT;
  ELSE
    RETURN QUERY SELECT 5, 'Normal'::TEXT;
  END IF;
END;
$$;


-- ============================================
-- Function: lgpd_erase_patient_data
-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.lgpd_erase_patient_data(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_confirmation_token TEXT,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID := auth.uid();
  v_expected_token TEXT;
  v_patient_exists BOOLEAN;
  v_patient_name TEXT;
  v_anonymized_name TEXT;

  -- Contadores
  v_audit_deleted INTEGER := 0;
  v_notifications_deleted INTEGER := 0;
  v_patient_updated INTEGER := 0;
  v_records_anonymized INTEGER := 0;
  v_prescriptions_anonymized INTEGER := 0;
  v_certificates_anonymized INTEGER := 0;
  v_exams_anonymized INTEGER := 0;
  v_referrals_anonymized INTEGER := 0;
  v_evolutions_anonymized INTEGER := 0;
  v_appointments_anonymized INTEGER := 0;
  v_request_updated INTEGER := 0;
BEGIN
  -- ── 1. Validação de segurança ──
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_tenant_admin(v_requester, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar exclusão de dados de paciente';
  END IF;

  -- Verificar se paciente existe no tenant
  SELECT EXISTS(
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND tenant_id = p_tenant_id
  ), (
    SELECT name FROM public.patients
    WHERE id = p_patient_id AND tenant_id = p_tenant_id
  )
  INTO v_patient_exists, v_patient_name;

  IF NOT v_patient_exists THEN
    RAISE EXCEPTION 'Paciente não encontrado neste tenant';
  END IF;

  -- ── 2. Confirmação por token (proteção contra chamada acidental) ──
  v_expected_token := 'ERASE_PATIENT:' || p_patient_id::text;
  IF COALESCE(p_confirmation_token, '') <> v_expected_token THEN
    RAISE EXCEPTION 'Token de confirmação inválido. Esperado: ERASE_PATIENT:<patient_id>';
  END IF;

  -- ── 3. Hash irreversível para pseudonimização ──
  v_anonymized_name := 'PACIENTE ANONIMIZADO #' || left(encode(digest(p_patient_id::text || now()::text, 'sha256'), 'hex'), 8);

  -- ════════════════════════════════════════════════════════════════════════
  -- DELEÇÃO FÍSICA (dados sem obrigação legal de retenção)
  -- ════════════════════════════════════════════════════════════════════════

  -- 3a. Audit logs de navegação/acesso (não exigidos por CFM)
  DELETE FROM public.audit_logs
  WHERE tenant_id = p_tenant_id
    AND entity_type = 'patients'
    AND entity_id = p_patient_id::text;
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

  -- 3b. Notificações push/in-app do paciente (se houver user_id vinculado)
  DELETE FROM public.notifications
  WHERE tenant_id = p_tenant_id
    AND metadata->>'patient_id' = p_patient_id::text;
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

  -- ════════════════════════════════════════════════════════════════════════
  -- ANONIMIZAÇÃO (dados clínicos retidos 20 anos — CFM 1821/07)
  -- Eliminação de PII; estrutura clínica preservada.
  -- ════════════════════════════════════════════════════════════════════════

  -- 4. Paciente: substituir PII, manter tenant_id e id para integridade relacional
  UPDATE public.patients
  SET
    name = v_anonymized_name,
    email = NULL,
    phone = NULL,
    cpf = NULL,
    access_code = NULL,
    street = NULL,
    street_number = NULL,
    complement = NULL,
    neighborhood = NULL,
    city = NULL,
    state = NULL,
    zip_code = NULL,
    allergies = NULL,
    notes = NULL,
    insurance_card_number = NULL,
    -- Manter: date_of_birth (apenas ano, para estatísticas etárias)
    date_of_birth = CASE
      WHEN date_of_birth IS NOT NULL
      THEN make_date(extract(year FROM date_of_birth)::int, 1, 1)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_patient_id
    AND tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_patient_updated = ROW_COUNT;

  -- 5. Prontuários: limpar texto livre que possa conter nomes/contextos pessoais
  --    Preservar: diagnóstico, CID, plano terapêutico (valor clínico-científico)
  UPDATE public.medical_records
  SET
    chief_complaint = '** ANONIMIZADO **',
    anamnesis = NULL,
    physical_exam = NULL,
    notes = NULL,
    -- Manter: diagnosis, cid_code, treatment_plan, prescriptions (campo legado JSON)
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_records_anonymized = ROW_COUNT;

  -- 6. Prescrições: manter medicações (dados clínicos), limpar instruções pessoais
  UPDATE public.prescriptions
  SET
    instructions = NULL,
    -- Manter: medications, prescription_type, status, digital_signature
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_prescriptions_anonymized = ROW_COUNT;

  -- 7. Atestados: anonimizar conteúdo textual
  UPDATE public.medical_certificates
  SET
    content = '** CONTEÚDO ANONIMIZADO **',
    -- Manter: certificate_type, cid_code, days_off
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_certificates_anonymized = ROW_COUNT;

  -- 8. Exames: anonimizar resultado textual, manter tipo e status
  UPDATE public.exam_results
  SET
    result_text = '** ANONIMIZADO **',
    interpretation = NULL,
    -- Manter: exam_type, exam_name, status, lab_name
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_exams_anonymized = ROW_COUNT;

  -- 9. Encaminhamentos: anonimizar resumo clínico
  UPDATE public.referrals
  SET
    clinical_summary = NULL,
    reason = '** ANONIMIZADO **',
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_referrals_anonymized = ROW_COUNT;

  -- 10. Evoluções clínicas: anonimizar SOAP + notas
  UPDATE public.clinical_evolutions
  SET
    subjective = '** ANONIMIZADO **',
    objective = NULL,
    assessment = NULL,
    plan = NULL,
    notes = NULL,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_evolutions_anonymized = ROW_COUNT;

  -- 11. Agendamentos: limpar notas textuais
  UPDATE public.appointments
  SET
    notes = NULL,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_appointments_anonymized = ROW_COUNT;

  -- ════════════════════════════════════════════════════════════════════════
  -- AUDITORIA E TRACKING
  -- ════════════════════════════════════════════════════════════════════════

  -- 12. Marcar lgpd_data_request como concluída (se fornecida)
  IF p_request_id IS NOT NULL THEN
    UPDATE public.lgpd_data_requests
    SET
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    WHERE id = p_request_id
      AND tenant_id = p_tenant_id;
    GET DIAGNOSTICS v_request_updated = ROW_COUNT;
  END IF;

  -- 13. Log de auditoria com resumo completo (este log NÃO contém PII)
  PERFORM public.log_tenant_action(
    p_tenant_id,
    v_requester,
    'lgpd_patient_data_erasure',
    'patients',
    p_patient_id::text,
    jsonb_build_object(
      'anonymized_name', v_anonymized_name,
      'audit_logs_deleted', v_audit_deleted,
      'notifications_deleted', v_notifications_deleted,
      'patient_record_anonymized', v_patient_updated,
      'medical_records_anonymized', v_records_anonymized,
      'prescriptions_anonymized', v_prescriptions_anonymized,
      'certificates_anonymized', v_certificates_anonymized,
      'exams_anonymized', v_exams_anonymized,
      'referrals_anonymized', v_referrals_anonymized,
      'evolutions_anonymized', v_evolutions_anonymized,
      'appointments_anonymized', v_appointments_anonymized,
      'lgpd_request_updated', v_request_updated,
      'executed_at', now()::text,
      'confirmation_token_valid', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', p_patient_id,
    'anonymized_name', v_anonymized_name,
    'summary', jsonb_build_object(
      'physical_deletions', jsonb_build_object(
        'audit_logs', v_audit_deleted,
        'notifications', v_notifications_deleted
      ),
      'anonymizations', jsonb_build_object(
        'patient_record', v_patient_updated,
        'medical_records', v_records_anonymized,
        'prescriptions', v_prescriptions_anonymized,
        'certificates', v_certificates_anonymized,
        'exams', v_exams_anonymized,
        'referrals', v_referrals_anonymized,
        'evolutions', v_evolutions_anonymized,
        'appointments', v_appointments_anonymized
      ),
      'lgpd_request_marked_completed', v_request_updated
    ),
    'executed_at', now()
  );
END;
$$;


-- ============================================
-- Function: preview_lgpd_patient_erasure
-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.preview_lgpd_patient_erasure(
  p_tenant_id UUID,
  p_patient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID := auth.uid();
  v_patient_name TEXT;
  v_counts JSONB;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_tenant_admin(v_requester, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar prévia de exclusão';
  END IF;

  SELECT name INTO v_patient_name
  FROM public.patients
  WHERE id = p_patient_id AND tenant_id = p_tenant_id;

  IF v_patient_name IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado neste tenant';
  END IF;

  SELECT jsonb_build_object(
    'patient_name', v_patient_name,
    'patient_id', p_patient_id,
    'confirmation_token', 'ERASE_PATIENT:' || p_patient_id::text,
    'will_delete', jsonb_build_object(
      'audit_logs', (SELECT count(*) FROM public.audit_logs WHERE tenant_id = p_tenant_id AND entity_type = 'patients' AND entity_id = p_patient_id::text),
      'notifications', (SELECT count(*) FROM public.notifications WHERE tenant_id = p_tenant_id AND metadata->>'patient_id' = p_patient_id::text)
    ),
    'will_anonymize', jsonb_build_object(
      'patient_record', 1,
      'medical_records', (SELECT count(*) FROM public.medical_records WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'prescriptions', (SELECT count(*) FROM public.prescriptions WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'certificates', (SELECT count(*) FROM public.medical_certificates WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'exams', (SELECT count(*) FROM public.exam_results WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'referrals', (SELECT count(*) FROM public.referrals WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'evolutions', (SELECT count(*) FROM public.clinical_evolutions WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'appointments', (SELECT count(*) FROM public.appointments WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id)
    ),
    'warning', 'Esta ação é IRREVERSÍVEL. Dados pessoais serão permanentemente removidos. Dados clínicos serão anonimizados conforme CFM 1821/07.'
  ) INTO v_counts;

  RETURN v_counts;
END;
$$;


-- ============================================
-- Function: get_patient_medical_reports
-- Source: 20260701000000_patient_portal_gaps_fix_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_medical_reports(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', mr.id,
        'tenant_id', mr.tenant_id,
        'tipo', mr.tipo,
        'finalidade', mr.finalidade,
        'historia_clinica', mr.historia_clinica,
        'exame_fisico', mr.exame_fisico,
        'exames_complementares', mr.exames_complementares,
        'diagnostico', mr.diagnostico,
        'cid10', mr.cid10,
        'conclusao', mr.conclusao,
        'observacoes', mr.observacoes,
        'status', mr.status,
        'signed_at', mr.signed_at,
        'created_at', mr.created_at,
        'professional_name', COALESCE(pr.full_name, ''),
        'professional_council', COALESCE(pr.council_number, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.medical_reports mr
      LEFT JOIN public.profiles pr ON pr.id = mr.professional_id
      LEFT JOIN public.tenants t ON t.id = mr.tenant_id
      WHERE mr.patient_id = v_link.client_id
        AND mr.tenant_id = v_link.tenant_id
        AND mr.status IN ('finalizado', 'assinado')
      ORDER BY mr.created_at DESC;
  END LOOP;
END;
$$;


-- ============================================
-- Function: notify_patient_multi_channel
-- Source: 20260702000000_notification_system_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_patient_multi_channel(
  p_tenant_id UUID,
  p_client_id UUID,
  p_trigger_type TEXT,
  p_template_vars JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_result JSONB := '{"channels_queued": []}'::jsonb;
  v_rules RECORD;
  v_channels_queued TEXT[] := '{}';
BEGIN
  -- Get patient notification preferences (or defaults)
  SELECT 
    COALESCE(p.email_enabled, true) as email_enabled,
    COALESCE(p.sms_enabled, true) as sms_enabled,
    COALESCE(p.whatsapp_enabled, true) as whatsapp_enabled,
    COALESCE(p.opt_out_types, '{}') as opt_out_types
  INTO v_prefs
  FROM public.patient_notification_preferences p
  WHERE p.client_id = p_client_id AND p.tenant_id = p_tenant_id;

  -- If no preferences found, use all defaults (all enabled)
  IF NOT FOUND THEN
    v_prefs := ROW(true, true, true, '{}'::text[]);
  END IF;

  -- Check if patient opted out of this trigger type
  IF p_trigger_type = ANY(v_prefs.opt_out_types) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'patient_opted_out');
  END IF;

  -- Find matching automation rules
  FOR v_rules IN
    SELECT id, channel, message_template
    FROM public.automations
    WHERE tenant_id = p_tenant_id
      AND trigger_type = p_trigger_type
      AND is_active = true
  LOOP
    -- Check if channel is enabled for this patient
    IF (v_rules.channel = 'email' AND v_prefs.email_enabled)
       OR (v_rules.channel = 'sms' AND v_prefs.sms_enabled)
       OR (v_rules.channel = 'whatsapp' AND v_prefs.whatsapp_enabled)
    THEN
      v_channels_queued := array_append(v_channels_queued, v_rules.channel);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'channels_queued', to_jsonb(v_channels_queued),
    'trigger_type', p_trigger_type,
    'client_id', p_client_id
  );
END;
$$;


-- ============================================
-- Function: auto_link_patient
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_patient()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_patient RECORD;
  v_pp_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  IF EXISTS (SELECT 1 FROM public.patient_profiles WHERE user_id = v_user_id AND is_active = true) THEN
    RETURN jsonb_build_object('linked', true, 'reason', 'ALREADY_LINKED');
  END IF;

  SELECT id, tenant_id, name INTO v_patient FROM public.patients WHERE user_id = v_user_id LIMIT 1;

  IF v_patient IS NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    IF v_user_email IS NOT NULL AND v_user_email <> '' THEN
      SELECT id, tenant_id, name INTO v_patient FROM public.patients WHERE lower(email) = lower(v_user_email) LIMIT 1;
      IF v_patient IS NOT NULL THEN
        UPDATE public.patients SET user_id = v_user_id, updated_at = now() WHERE id = v_patient.id AND user_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'PATIENT_NOT_FOUND');
  END IF;

  INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
  VALUES (v_user_id, v_patient.tenant_id, v_patient.id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, is_active = true, updated_at = now()
  RETURNING id INTO v_pp_id;

  RETURN jsonb_build_object('linked', true, 'reason', 'AUTO_LINKED', 'patient_profile_id', v_pp_id, 'patient_name', v_patient.name);
END;
$$;


-- ============================================
-- Function: get_patient_profile
-- Source: APLICAR_MIGRATION_900000.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_link   record;
  v_pat    record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT client_id, tenant_id INTO v_link
  FROM public.patient_profiles
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_link IS NULL THEN
    RETURN jsonb_build_object('error', 'NO_LINK');
  END IF;

  SELECT
    p.id,
    p.name,
    p.email,
    p.phone,
    p.cpf,
    p.date_of_birth,
    p.marital_status,
    p.zip_code,
    p.street,
    p.street_number,
    p.complement,
    p.neighborhood,
    p.city,
    p.state,
    p.allergies
  INTO v_pat
  FROM public.patients p
  WHERE p.id = v_link.client_id;

  IF v_pat IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN jsonb_build_object(
    'id',              v_pat.id,
    'name',            COALESCE(v_pat.name, ''),
    'email',           v_pat.email,
    'phone',           v_pat.phone,
    'cpf',             v_pat.cpf,
    'date_of_birth',   v_pat.date_of_birth,
    'marital_status',  v_pat.marital_status,
    'zip_code',        v_pat.zip_code,
    'street',          v_pat.street,
    'street_number',   v_pat.street_number,
    'complement',      v_pat.complement,
    'neighborhood',    v_pat.neighborhood,
    'city',            v_pat.city,
    'state',           v_pat.state,
    'allergies',       v_pat.allergies
  );
END;
$$;


-- ============================================
-- Function: update_patient_contact
-- Source: APLICAR_MIGRATION_900000.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_patient_contact(
  p_phone         text DEFAULT NULL,
  p_email         text DEFAULT NULL,
  p_zip_code      text DEFAULT NULL,
  p_street        text DEFAULT NULL,
  p_street_number text DEFAULT NULL,
  p_complement    text DEFAULT NULL,
  p_neighborhood  text DEFAULT NULL,
  p_city          text DEFAULT NULL,
  p_state         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_link      record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT client_id, tenant_id INTO v_link
  FROM public.patient_profiles
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_link IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_LINK');
  END IF;

  UPDATE public.patients SET
    phone          = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
    email          = COALESCE(NULLIF(TRIM(p_email), ''), email),
    zip_code       = COALESCE(NULLIF(TRIM(p_zip_code), ''), zip_code),
    street         = COALESCE(NULLIF(TRIM(p_street), ''), street),
    street_number  = COALESCE(NULLIF(TRIM(p_street_number), ''), street_number),
    complement     = CASE WHEN p_complement IS NOT NULL THEN NULLIF(TRIM(p_complement), '') ELSE complement END,
    neighborhood   = COALESCE(NULLIF(TRIM(p_neighborhood), ''), neighborhood),
    city           = COALESCE(NULLIF(TRIM(p_city), ''), city),
    state          = COALESCE(NULLIF(TRIM(p_state), ''), state),
    updated_at     = now()
  WHERE id = v_link.client_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================
-- Function: patient_online_checkin
-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_online_checkin(
  p_appointment_id uuid,
  p_form_responses jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_patient_id    uuid;
  v_appt          record;
  v_hours_until   numeric;
  v_form_id       uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  -- Busca patient_id do user
  SELECT pp.client_id INTO v_patient_id
  FROM patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Perfil de paciente não encontrado');
  END IF;

  -- Busca appointment
  SELECT a.* INTO v_appt
  FROM appointments a
  WHERE a.id = p_appointment_id
    AND (a.client_id = v_patient_id OR a.patient_id = v_patient_id);

  IF v_appt IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Consulta não encontrada');
  END IF;

  IF v_appt.status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta consulta não pode receber check-in');
  END IF;

  -- Check-in permitido até 24h antes
  v_hours_until := EXTRACT(EPOCH FROM (v_appt.scheduled_at - NOW())) / 3600;
  IF v_hours_until > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Check-in disponível até 24h antes da consulta');
  END IF;

  IF v_hours_until < -2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'A consulta já passou');
  END IF;

  -- Salva respostas do questionário se fornecidas
  IF p_form_responses IS NOT NULL AND p_form_responses != '{}'::jsonb THEN
    -- Busca form_id aplicável
    SELECT f.id INTO v_form_id
    FROM pre_consultation_forms f
    WHERE f.tenant_id = v_appt.tenant_id
      AND f.is_active = true
      AND (f.service_id = v_appt.service_id OR f.service_id IS NULL)
    ORDER BY
      CASE WHEN f.service_id = v_appt.service_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_form_id IS NOT NULL THEN
      INSERT INTO pre_consultation_responses (
        tenant_id, appointment_id, form_id, patient_id, responses
      ) VALUES (
        v_appt.tenant_id, p_appointment_id, v_form_id, v_patient_id, p_form_responses
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Marca check-in + confirma presença
  UPDATE appointments
  SET
    status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, NOW()),
    checkin_at = NOW(),
    checkin_method = 'online',
    updated_at = NOW()
  WHERE id = p_appointment_id;

  -- Cria notificação para o profissional
  IF v_appt.professional_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, tenant_id, type, title, message, data)
    SELECT
      p.user_id,
      v_appt.tenant_id,
      'checkin_online',
      'Check-in Online',
      (SELECT c.name FROM clients c WHERE c.id = v_patient_id) || ' fez check-in online',
      jsonb_build_object(
        'appointment_id', p_appointment_id,
        'patient_id', v_patient_id,
        'checkin_method', 'online',
        'has_preconsultation', (p_form_responses IS NOT NULL AND p_form_responses != '{}'::jsonb)
      )
    FROM profiles p
    WHERE p.id = v_appt.professional_id AND p.user_id IS NOT NULL;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Check-in realizado com sucesso!');
END;
$$;


-- ============================================
-- Function: patient_sign_document
-- Source: 20260721000001_fix_patient_sign_document_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_sign_document(
  p_document_type text,
  p_document_id uuid,
  p_signature_method text,
  p_signature_path text DEFAULT NULL,
  p_facial_photo_path text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_patient_id uuid;
  v_tenant_id uuid;
  v_existing uuid;
BEGIN
  -- Resolve patient profile
  SELECT pp.client_id INTO v_patient_id
  FROM patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Perfil de paciente não encontrado');
  END IF;

  -- Resolve tenant from patients table
  SELECT p.tenant_id INTO v_tenant_id
  FROM patients p
  WHERE p.id = v_patient_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Clínica não encontrada');
  END IF;

  -- Check if already signed
  SELECT id INTO v_existing
  FROM document_signatures
  WHERE patient_id = v_patient_id
    AND document_type = p_document_type
    AND document_id = p_document_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este documento já foi assinado');
  END IF;

  -- Validate document exists and belongs to this patient
  -- NOTE: client_id was renamed to patient_id by migration 20260330300000
  IF p_document_type = 'certificate' THEN
    PERFORM 1 FROM medical_certificates WHERE id = p_document_id AND patient_id = v_patient_id;
  ELSIF p_document_type = 'prescription' THEN
    PERFORM 1 FROM prescriptions WHERE id = p_document_id AND patient_id = v_patient_id;
  ELSIF p_document_type = 'exam' THEN
    PERFORM 1 FROM exam_results WHERE id = p_document_id AND patient_id = v_patient_id;
  ELSIF p_document_type = 'report' THEN
    PERFORM 1 FROM medical_reports WHERE id = p_document_id AND patient_id = v_patient_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Tipo de documento inválido');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Documento não encontrado ou sem permissão');
  END IF;

  -- Insert signature
  INSERT INTO document_signatures (
    tenant_id, patient_id, document_type, document_id,
    signature_method, signature_path, facial_photo_path,
    ip_address, user_agent
  ) VALUES (
    v_tenant_id, v_patient_id, p_document_type, p_document_id,
    p_signature_method, p_signature_path, p_facial_photo_path,
    NULL, p_user_agent
  );

  RETURN jsonb_build_object('success', true, 'message', 'Documento assinado com sucesso!');
END;
$$;


-- ============================================
-- Function: get_patient_document_signatures
-- Source: 20260721000000_document_signatures_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_document_signatures()
RETURNS TABLE (
  id uuid,
  document_type text,
  document_id uuid,
  signature_method text,
  signed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  SELECT pp.client_id INTO v_patient_id
  FROM patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ds.id, ds.document_type, ds.document_id, ds.signature_method, ds.signed_at
  FROM document_signatures ds
  WHERE ds.patient_id = v_patient_id
  ORDER BY ds.signed_at DESC;
END;
$$;


-- ============================================
-- Function: cleanup_patient_access_attempts
-- Source: 20260724000000_security_validate_patient_access_hardening.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_patient_access_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.patient_access_attempts
  WHERE created_at < now() - interval '30 days';
$$;


-- ============================================
-- Function: export_patient_data
-- Source: 20260724000001_lgpd_patient_data_export_deletion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.export_patient_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_patient RECORD;
  v_result jsonb;
  v_appointments jsonb;
  v_prescriptions jsonb;
  v_certificates jsonb;
  v_exams jsonb;
  v_messages jsonb;
  v_consents jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Não autenticado');
  END IF;

  -- Find patient
  SELECT p.id, p.name, p.email, p.phone, p.cpf, p.birth_date,
         p.gender, p.address, p.city, p.state, p.zip_code,
         p.tenant_id, p.created_at,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('error', 'Paciente não encontrado');
  END IF;

  -- Appointments
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', a.date,
    'time', a.time,
    'status', a.status,
    'service', s.name,
    'professional', st.name,
    'notes', a.notes,
    'created_at', a.created_at
  ) ORDER BY a.date DESC), '[]'::jsonb)
  INTO v_appointments
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.staff st ON st.id = a.staff_id
  WHERE a.patient_id = v_patient.id;

  -- Prescriptions
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', pr.created_at,
    'medications', pr.medications,
    'notes', pr.notes
  ) ORDER BY pr.created_at DESC), '[]'::jsonb)
  INTO v_prescriptions
  FROM public.prescriptions pr
  WHERE pr.patient_id = v_patient.id;

  -- Certificates
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', c.created_at,
    'type', c.type,
    'content', c.content
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_certificates
  FROM public.certificates c
  WHERE c.patient_id = v_patient.id;

  -- Exams
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', e.created_at,
    'name', e.name,
    'status', e.status
  ) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_exams
  FROM public.exams e
  WHERE e.patient_id = v_patient.id;

  -- Messages
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', m.created_at,
    'content', m.content,
    'sender', m.sender_type
  ) ORDER BY m.created_at DESC), '[]'::jsonb)
  INTO v_messages
  FROM public.messages m
  WHERE m.patient_id = v_patient.id;

  -- Consents
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', pc.signed_at,
    'document', pc.document_title,
    'ip', pc.ip_address
  ) ORDER BY pc.signed_at DESC), '[]'::jsonb)
  INTO v_consents
  FROM public.patient_consents pc
  WHERE pc.patient_id = v_patient.id;

  -- Build final result
  v_result := jsonb_build_object(
    'export_date', now(),
    'patient', jsonb_build_object(
      'name', v_patient.name,
      'email', v_patient.email,
      'phone', v_patient.phone,
      'cpf', v_patient.cpf,
      'birth_date', v_patient.birth_date,
      'gender', v_patient.gender,
      'address', v_patient.address,
      'city', v_patient.city,
      'state', v_patient.state,
      'zip_code', v_patient.zip_code,
      'registered_at', v_patient.created_at,
      'clinic', v_patient.clinic_name
    ),
    'appointments', v_appointments,
    'prescriptions', v_prescriptions,
    'certificates', v_certificates,
    'exams', v_exams,
    'messages', v_messages,
    'consents', v_consents
  );

  RETURN v_result;
END;
$$;


-- ============================================
-- Function: request_patient_account_deletion
-- Source: 20260724000001_lgpd_patient_data_export_deletion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.request_patient_account_deletion(
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_patient RECORD;
  v_existing RECORD;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Find patient
  SELECT id, tenant_id, name
  INTO v_patient
  FROM public.patients
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paciente não encontrado');
  END IF;

  -- Check if there's already a pending request
  SELECT id INTO v_existing
  FROM public.patient_deletion_requests
  WHERE patient_id = v_patient.id AND status = 'pending'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de exclusão pendente');
  END IF;

  -- Create deletion request (30 days grace period)
  INSERT INTO public.patient_deletion_requests (patient_id, user_id, reason, tenant_id)
  VALUES (v_patient.id, v_user_id, p_reason, v_patient.tenant_id)
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'scheduled_for', (now() + interval '30 days'),
    'message', 'Sua solicitação foi registrada. Seus dados serão removidos em 30 dias. Você pode cancelar durante esse período.'
  );
END;
$$;


-- ============================================
-- Function: cancel_patient_account_deletion
-- Source: 20260724000001_lgpd_patient_data_export_deletion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_patient_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_request
  FROM public.patient_deletion_requests
  WHERE user_id = v_user_id AND status = 'pending'
  ORDER BY requested_at DESC
  LIMIT 1;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma solicitação pendente encontrada');
  END IF;

  UPDATE public.patient_deletion_requests
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_request.id;

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação de exclusão cancelada com sucesso');
END;
$$;


-- ============================================
-- Function: log_patient_activity
-- Source: 20260724000003_patient_activity_log.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.log_patient_activity(
  p_event_type TEXT,
  p_event_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;  -- Silencioso se não autenticado
  END IF;

  -- Validar event_type
  IF p_event_type NOT IN (
    'login', 'profile_update', 'exam_download', 'prescription_view',
    'consent_sign', 'data_export', 'deletion_request', 'mfa_change',
    'settings_update', 'report_view', 'certificate_view', 'logout'
  ) THEN
    RETURN;  -- Tipo desconhecido, ignorar silenciosamente
  END IF;

  INSERT INTO public.patient_activity_log (
    patient_user_id, event_type, event_description, metadata
  )
  VALUES (
    v_user_id,
    p_event_type,
    left(p_event_description, 500),
    p_metadata
  );
END;
$$;


-- ============================================
-- Function: get_patient_activity_log
-- Source: 20260724000003_patient_activity_log.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_activity_log(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pal.id,
    pal.event_type,
    pal.event_description,
    pal.metadata,
    pal.created_at
  FROM public.patient_activity_log pal
  WHERE pal.patient_user_id = v_user_id
  ORDER BY pal.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$;


-- ============================================
-- Function: cleanup_patient_activity_log
-- Source: 20260724000003_patient_activity_log.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_patient_activity_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.patient_activity_log
  WHERE created_at < now() - interval '1 year';
$$;

