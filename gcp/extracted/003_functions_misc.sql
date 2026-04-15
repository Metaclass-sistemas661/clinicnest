-- GCP Migration: Functions - misc
-- Total: 59 functions


-- ============================================
-- Function: update_updated_at_column
-- Source: 20260201191708_646ef9b2-92d4-4efc-b496-2069d60281ca.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;


-- ============================================
-- Function: user_has_tenant_access
-- Source: 20260703000000_fix_patient_portal_renames_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  )
  OR EXISTS (
    SELECT 1 FROM public.patient_profiles
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND is_active = true
  );
$$;


-- ============================================
-- Function: tenant_has_access
-- Source: 20260307000000_enforce_subscription_access_rls.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_has_access(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.tenant_id = p_tenant_id
      AND (
        lower(s.status) = 'active'
        OR (lower(s.status) = 'trialing' AND now() <= s.trial_end)
      )
    LIMIT 1
  );
$$;


-- ============================================
-- Function: tenant_within_client_limit
-- Source: 20260704400000_fix_plan_tier_mapping_new_names.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_within_client_limit(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH trial_check AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.tenant_id = p_tenant_id
        AND lower(s.status) = 'trialing'
        AND s.trial_end IS NOT NULL
        AND now() <= s.trial_end
    ) AS is_trialing
  ),
  tier AS (
    SELECT public.tenant_plan_tier(p_tenant_id) AS tier
  ),
  lim AS (
    SELECT CASE
      -- Trial: sem limite
      WHEN (SELECT is_trialing FROM trial_check) THEN NULL
      WHEN (SELECT tier FROM tier) = 'starter'  THEN 100
      WHEN (SELECT tier FROM tier) = 'solo'     THEN 500
      WHEN (SELECT tier FROM tier) = 'clinica'  THEN 3000
      WHEN (SELECT tier FROM tier) = 'premium'  THEN NULL
      ELSE 100
    END AS max_clients
  )
  SELECT
    (SELECT max_clients FROM lim) IS NULL
    OR (
      SELECT count(*)
      FROM public.patients p
      WHERE p.tenant_id = p_tenant_id
    ) < (SELECT max_clients FROM lim);
$$;


-- ============================================
-- Function: tenant_plan_tier
-- Source: 20260704400000_fix_plan_tier_mapping_new_names.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_plan_tier(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Sem plano definido
    WHEN s.plan IS NULL THEN 'starter'
    -- Legado: só interval sem tier
    WHEN lower(s.plan) IN ('monthly','quarterly','annual') THEN 'solo'
    -- Extrair tier da key "tier_interval"
    ELSE CASE split_part(lower(s.plan), '_', 1)
      WHEN 'starter'  THEN 'starter'
      WHEN 'solo'     THEN 'solo'
      WHEN 'clinic'   THEN 'clinica'
      WHEN 'clinica'  THEN 'clinica'
      WHEN 'premium'  THEN 'premium'
      -- Legado
      WHEN 'basic'    THEN 'solo'
      WHEN 'pro'      THEN 'clinica'
      ELSE 'starter'
    END
  END
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;
$$;


-- ============================================
-- Function: tenant_has_feature
-- Source: 20260704400000_fix_plan_tier_mapping_new_names.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Trial ativo: tudo liberado
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.tenant_id = p_tenant_id
        AND lower(s.status) = 'trialing'
        AND s.trial_end IS NOT NULL
        AND now() <= s.trial_end
      LIMIT 1
    ) THEN true
    -- Premium: tudo liberado
    WHEN public.tenant_plan_tier(p_tenant_id) = 'premium' THEN true
    -- Clínica: features avançadas
    WHEN public.tenant_plan_tier(p_tenant_id) = 'clinica' THEN
      lower(coalesce(p_feature, '')) IN (
        'pdf_export',
        'data_export',
        'advanced_reports',
        'whatsapp_support',
        'odontogram',
        'periogram',
        'tiss',
        'commissions',
        'sngpc',
        'custom_reports'
      )
    -- Solo: features básicas
    WHEN public.tenant_plan_tier(p_tenant_id) = 'solo' THEN
      lower(coalesce(p_feature, '')) IN (
        'pdf_export',
        'data_export'
      )
    -- Starter: sem features avançadas
    ELSE
      false
  END;
$$;


-- ============================================
-- Function: upsert_user_tour_progress
-- Source: 20260215173000_user_tours.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_user_tour_progress(
  p_tenant_id uuid,
  p_tour_key text,
  p_step_index integer,
  p_completed boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_tour_key IS NULL OR btrim(p_tour_key) = '' THEN
    RAISE EXCEPTION 'tour_key é obrigatório';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  -- Ensure user belongs to tenant
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence ao tenant';
  END IF;

  INSERT INTO public.user_tour_progress (tenant_id, user_id, tour_key, step_index, completed_at)
  VALUES (
    p_tenant_id,
    v_user_id,
    p_tour_key,
    GREATEST(0, COALESCE(p_step_index, 0)),
    CASE WHEN p_completed THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id, tour_key)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    step_index = EXCLUDED.step_index,
    completed_at = CASE
      WHEN p_completed THEN now()
      ELSE NULL
    END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ============================================
-- Function: reset_user_tour_progress
-- Source: 20260215173000_user_tours.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.reset_user_tour_progress(
  p_tour_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  DELETE FROM public.user_tour_progress
  WHERE user_id = v_user_id
    AND tour_key = p_tour_key;
END;
$$;


-- ============================================
-- Function: upsert_client_v2
-- Source: 20260323200000_client_allergies_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_client_v2(
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_street text DEFAULT NULL,
  p_street_number text DEFAULT NULL,
  p_complement text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_allergies text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_access_code text;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome é obrigatório');
  END IF;

  IF p_client_id IS NULL THEN
    v_action := 'client_created';
    INSERT INTO public.clients(
      tenant_id, name, phone, email, notes, cpf,
      date_of_birth, marital_status,
      zip_code, street, street_number, complement, neighborhood, city, state,
      allergies
    )
    VALUES (
      v_profile.tenant_id, p_name, NULLIF(p_phone,''), NULLIF(p_email,''), NULLIF(p_notes,''), NULLIF(btrim(p_cpf),''),
      p_date_of_birth, NULLIF(btrim(p_marital_status),''),
      NULLIF(btrim(p_zip_code),''), NULLIF(btrim(p_street),''), NULLIF(btrim(p_street_number),''),
      NULLIF(btrim(p_complement),''), NULLIF(btrim(p_neighborhood),''), NULLIF(btrim(p_city),''), NULLIF(btrim(p_state),''),
      NULLIF(btrim(p_allergies),'')
    )
    RETURNING id, access_code INTO v_id, v_access_code;
  ELSE
    v_action := 'client_updated';
    UPDATE public.clients
    SET name = p_name,
        phone = NULLIF(p_phone,''),
        email = NULLIF(p_email,''),
        notes = NULLIF(p_notes,''),
        cpf = NULLIF(btrim(p_cpf),''),
        date_of_birth = p_date_of_birth,
        marital_status = NULLIF(btrim(p_marital_status),''),
        zip_code = NULLIF(btrim(p_zip_code),''),
        street = NULLIF(btrim(p_street),''),
        street_number = NULLIF(btrim(p_street_number),''),
        complement = NULLIF(btrim(p_complement),''),
        neighborhood = NULLIF(btrim(p_neighborhood),''),
        city = NULLIF(btrim(p_city),''),
        state = NULLIF(btrim(p_state),''),
        allergies = NULLIF(btrim(p_allergies),''),
        updated_at = now()
    WHERE id = p_client_id
      AND tenant_id = v_profile.tenant_id
    RETURNING id, access_code INTO v_id, v_access_code;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Paciente não encontrado');
    END IF;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    v_action,
    'client',
    v_id::text,
    jsonb_build_object('name', p_name)
  );

  RETURN jsonb_build_object('success', true, 'client_id', v_id, 'access_code', v_access_code);
END;
$$;


-- ============================================
-- Function: upsert_service_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_service_v2(
  p_name text,
  p_duration_minutes integer,
  p_price numeric,
  p_description text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_service_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar serviços');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome é obrigatório');
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 5 OR p_duration_minutes > 480 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Duração inválida');
  END IF;

  IF p_price IS NULL OR p_price < 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Preço inválido');
  END IF;

  IF p_service_id IS NULL THEN
    v_action := 'service_created';
    INSERT INTO public.services(tenant_id, name, description, duration_minutes, price, is_active)
    VALUES (v_profile.tenant_id, p_name, NULLIF(p_description,''), p_duration_minutes, p_price, COALESCE(p_is_active,true))
    RETURNING id INTO v_id;
  ELSE
    v_action := 'service_updated';
    UPDATE public.services
    SET name = p_name,
        description = NULLIF(p_description,''),
        duration_minutes = p_duration_minutes,
        price = p_price,
        is_active = COALESCE(p_is_active, is_active),
        updated_at = now()
    WHERE id = p_service_id
      AND tenant_id = v_profile.tenant_id
    RETURNING id INTO v_id;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
    END IF;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    v_action,
    'service',
    v_id::text,
    jsonb_build_object(
      'name', p_name,
      'duration_minutes', p_duration_minutes,
      'price', p_price,
      'is_active', COALESCE(p_is_active,true)
    )
  );

  RETURN jsonb_build_object('success', true, 'service_id', v_id);
END;
$$;


-- ============================================
-- Function: set_service_active_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_service_active_v2(
  p_service_id uuid,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode alterar status do serviço');
  END IF;

  UPDATE public.services
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_service_id
    AND tenant_id = v_profile.tenant_id
  RETURNING id INTO v_id;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'service_active_changed',
    'service',
    v_id::text,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'service_id', v_id, 'is_active', p_is_active);
END;
$$;


-- ============================================
-- Function: get_tenant_by_booking_slug_v1
-- Source: 20260312000000_online_booking_v1.sql
-- ============================================
create or replace function public.get_tenant_by_booking_slug_v1(p_slug text)
returns public.tenants
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.tenants t
  where t.online_booking_slug is not null
    and lower(t.online_booking_slug) = lower(btrim(p_slug))
  limit 1;
$$;


-- ============================================
-- Function: log_clinical_access
-- Source: 20260323700000_clinical_access_audit_v1.sql
-- ============================================
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


-- ============================================
-- Function: set_updated_at
-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
-- ============================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ============================================
-- Function: generate_client_access_code
-- Source: 20260322000000_patient_access_code_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_client_access_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.access_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  LOOP
    -- Generate PAC-XXXXXX (6 alphanumeric uppercase chars)
    v_code := 'PAC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    SELECT EXISTS(SELECT 1 FROM public.clients WHERE access_code = v_code) INTO v_exists;

    IF NOT v_exists THEN
      NEW.access_code := v_code;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: seed_role_templates_for_tenant
-- Source: 20260323400000_rbac_foundation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.seed_role_templates_for_tenant(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_templates JSONB := '[
    {
      "type": "admin",
      "name": "Administrador",
      "perms": {
        "dashboard":"vcud","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"v","laudos":"v","atestados":"v",
        "encaminhamentos":"v","triagem":"v","evolucao_enfermagem":"v","evolucao_clinica":"v",
        "odontograma":"v","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"vcud",
        "chat":"vcud","financeiro":"vcud","faturamento_tiss":"vcud","convenios":"vcud",
        "relatorios":"vcud","compras":"vcud","fornecedores":"vcud","produtos":"vcud",
        "campanhas":"vcud","automacoes":"vcud","equipe":"vcud","configuracoes":"vcud",
        "auditoria":"vcud","assinatura":"vcud","disponibilidade":"vcud",
        "especialidades":"vcud","modelos_prontuario":"vcud","termos_consentimento":"vcud",
        "contratos_termos":"vcud","integracoes":"vcud","api_docs":"vcud",
        "agendamento_online":"vcud","fidelidade_cashback":"vcud","vouchers":"vcud","cupons":"vcud"
      }
    },
    {
      "type": "medico",
      "name": "Médico(a)",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"vcud",
        "prontuarios":"vcud","receituarios":"vcud","laudos":"vcud","atestados":"vcud",
        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"v","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "dentista",
      "name": "Dentista",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"vcud",
        "prontuarios":"vcud","receituarios":"vcud","laudos":"vcud","atestados":"vcud",
        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"vcud","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "enfermeiro",
      "name": "Enfermeiro(a)",
      "perms": {
        "dashboard":"v","agenda":"vu","clientes":"vu","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"v","triagem":"vcud","evolucao_enfermagem":"vcud","evolucao_clinica":"v",
        "odontograma":"","teleconsulta":"","lista_espera":"v","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "tec_enfermagem",
      "name": "Técnico(a) de Enfermagem",
      "perms": {
        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"vcud","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"","lista_espera":"v","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "fisioterapeuta",
      "name": "Fisioterapeuta",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",
        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "nutricionista",
      "name": "Nutricionista",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "psicologo",
      "name": "Psicólogo(a)",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",
        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "fonoaudiologo",
      "name": "Fonoaudiólogo(a)",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",
        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "secretaria",
      "name": "Secretária / Recepcionista",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"v","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"vcud",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "faturista",
      "name": "Faturista",
      "perms": {
        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"","lista_espera":"","gestao_salas":"",
        "chat":"vcud","financeiro":"v","faturamento_tiss":"vcud","convenios":"v",
        "relatorios":"v","compras":"","fornecedores":"","produtos":"",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "custom",
      "name": "Perfil Customizado",
      "perms": {
        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"","lista_espera":"","gestao_salas":"",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    }
  ]'::jsonb;
  v_item JSONB;
  v_perms_expanded JSONB;
  v_resource TEXT;
  v_actions TEXT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_templates) LOOP
    v_perms_expanded := '{}'::jsonb;
    FOR v_resource, v_actions IN SELECT * FROM jsonb_each_text(v_item->'perms') LOOP
      v_perms_expanded := v_perms_expanded || jsonb_build_object(
        v_resource, jsonb_build_object(
          'view', v_actions LIKE '%v%',
          'create', v_actions LIKE '%c%',
          'edit', v_actions LIKE '%u%',
          'delete', v_actions LIKE '%d%'
        )
      );
    END LOOP;

    INSERT INTO public.role_templates (tenant_id, name, professional_type, permissions, is_system)
    VALUES (
      p_tenant_id,
      v_item->>'name',
      (v_item->>'type')::public.professional_type,
      v_perms_expanded,
      true
    )
    ON CONFLICT (tenant_id, professional_type) DO NOTHING;
  END LOOP;
END;
$$;


-- ============================================
-- Function: is_prescriber
-- Source: 20260323400000_rbac_foundation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.is_prescriber(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND professional_type IN ('medico','dentista')
  );
$$;


-- ============================================
-- Function: is_admin_or_faturista
-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin_or_faturista(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_user_id AND p.professional_type = 'faturista'
  );
$$;


-- ============================================
-- Function: log_access_denied
-- Source: 20260323700000_clinical_access_audit_v1.sql
-- ============================================
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


-- ============================================
-- Function: get_clinical_access_report
-- Source: 20260323700000_clinical_access_audit_v1.sql
-- ============================================
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


-- ============================================
-- Function: update_role_template_permissions
-- Source: 20260323800000_rbac_refinements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_role_template_permissions(
  p_professional_type public.professional_type,
  p_permissions JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem tenant';
  END IF;

  IF NOT public.is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar templates de permissão';
  END IF;

  UPDATE public.role_templates
  SET permissions = p_permissions, updated_at = now()
  WHERE tenant_id = v_tenant_id AND professional_type = p_professional_type;

  RETURN FOUND;
END;
$$;


-- ============================================
-- Function: set_user_readonly
-- Source: 20260323800000_rbac_refinements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_readonly(
  p_target_user_id UUID,
  p_readonly BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem tenant';
  END IF;

  IF NOT public.is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar modo somente leitura';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Usuário não pertence ao tenant';
  END IF;

  UPDATE public.profiles
  SET 
    is_readonly = p_readonly,
    readonly_reason = CASE WHEN p_readonly THEN p_reason ELSE NULL END,
    readonly_since = CASE WHEN p_readonly THEN now() ELSE NULL END
  WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id;

  RETURN FOUND;
END;
$$;


-- ============================================
-- Function: update_report_updated_at
-- Source: 20260324100000_custom_reports_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: cleanup_expired_verification_codes
-- Source: 20260324200000_email_verification_codes.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.email_verification_codes
  WHERE expires_at < now() - interval '1 hour';
$$;


-- ============================================
-- Function: calcular_prazo_notificacao_anpd
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calcular_prazo_notificacao_anpd()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prazo de 72 horas para notificação (Art. 48 § 1º)
  IF NEW.requer_notificacao_anpd = true THEN
    NEW.prazo_notificacao := NEW.data_deteccao + INTERVAL '72 hours';
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: registrar_historico_solicitacao
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION registrar_historico_solicitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.historico := NEW.historico || jsonb_build_object(
      'timestamp', NOW(),
      'status_anterior', OLD.status,
      'status_novo', NEW.status,
      'usuario', auth.uid()
    );
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: registrar_acao_incidente
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION registrar_acao_incidente(
  p_incidente_id UUID,
  p_acao TEXT,
  p_detalhes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE lgpd_incidentes
  SET 
    timeline_acoes = timeline_acoes || jsonb_build_object(
      'timestamp', NOW(),
      'acao', p_acao,
      'detalhes', p_detalhes,
      'usuario', auth.uid()
    ),
    updated_at = NOW()
  WHERE id = p_incidente_id;
  
  RETURN FOUND;
END;
$$;


-- ============================================
-- Function: calc_tempo_espera
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calc_tempo_espera(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  media NUMERIC,
  minimo NUMERIC,
  maximo NUMERIC,
  p90 NUMERIC,
  total INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as media,
    ROUND(MIN(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as minimo,
    ROUND(MAX(EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as maximo,
    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (a.start_time - t.created_at)) / 60)::NUMERIC, 2) as p90,
    COUNT(*)::INTEGER as total
  FROM appointments a
  JOIN triages t ON t.appointment_id = a.id
  WHERE a.tenant_id = p_tenant_id
    AND a.date BETWEEN p_inicio AND p_fim
    AND a.status = 'completed'
    AND t.created_at IS NOT NULL
    AND a.start_time IS NOT NULL
    AND a.start_time > t.created_at;
END;
$$;


-- ============================================
-- Function: calc_taxa_cancelamento
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calc_taxa_cancelamento(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  taxa_cancel NUMERIC,
  taxa_ns NUMERIC,
  total_agend INTEGER,
  total_cancel INTEGER,
  total_ns INTEGER,
  total_realiz INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND((COUNT(*) FILTER (WHERE status = 'cancelled')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa_cancel,
    ROUND((COUNT(*) FILTER (WHERE status = 'no_show')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa_ns,
    COUNT(*)::INTEGER as total_agend,
    COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER as total_cancel,
    COUNT(*) FILTER (WHERE status = 'no_show')::INTEGER as total_ns,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as total_realiz
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND date BETWEEN p_inicio AND p_fim;
END;
$$;


-- ============================================
-- Function: calc_completude_prontuario
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calc_completude_prontuario(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  completude NUMERIC,
  total INTEGER,
  completos INTEGER,
  campos_faltantes JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
  v_completos INTEGER;
  v_campos JSONB := '{}';
BEGIN
  -- Conta prontuários do período
  SELECT COUNT(*) INTO v_total
  FROM medical_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim;
  
  -- Conta prontuários com campos obrigatórios preenchidos
  SELECT COUNT(*) INTO v_completos
  FROM medical_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim
    AND subjective IS NOT NULL AND subjective != ''
    AND objective IS NOT NULL AND objective != ''
    AND assessment IS NOT NULL AND assessment != ''
    AND plan IS NOT NULL AND plan != '';
  
  -- Conta campos faltantes
  SELECT jsonb_build_object(
    'subjective', COUNT(*) FILTER (WHERE subjective IS NULL OR subjective = ''),
    'objective', COUNT(*) FILTER (WHERE objective IS NULL OR objective = ''),
    'assessment', COUNT(*) FILTER (WHERE assessment IS NULL OR assessment = ''),
    'plan', COUNT(*) FILTER (WHERE plan IS NULL OR plan = '')
  ) INTO v_campos
  FROM medical_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim;
  
  RETURN QUERY SELECT 
    ROUND((v_completos::NUMERIC / NULLIF(v_total, 0) * 100), 2),
    v_total,
    v_completos,
    v_campos;
END;
$$;


-- ============================================
-- Function: calc_ocupacao_salas
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calc_ocupacao_salas(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  taxa NUMERIC,
  horas_disp NUMERIC,
  horas_ocup NUMERIC,
  por_sala JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dias INTEGER;
  v_salas INTEGER;
  v_horas_dia NUMERIC := 10; -- 10 horas úteis por dia
  v_horas_disp NUMERIC;
  v_horas_ocup NUMERIC;
  v_por_sala JSONB;
BEGIN
  -- Calcula dias úteis no período (simplificado)
  v_dias := (p_fim - p_inicio) + 1;
  
  -- Conta salas ativas
  SELECT COUNT(*) INTO v_salas
  FROM rooms
  WHERE tenant_id = p_tenant_id AND is_active = true;
  
  v_horas_disp := v_dias * v_salas * v_horas_dia;
  
  -- Calcula horas ocupadas
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (
      COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time
    )) / 3600
  ), 0) INTO v_horas_ocup
  FROM room_occupancies ro
  JOIN rooms r ON r.id = ro.room_id
  WHERE r.tenant_id = p_tenant_id
    AND ro.start_time::DATE BETWEEN p_inicio AND p_fim;
  
  -- Ocupação por sala
  SELECT COALESCE(jsonb_object_agg(
    r.id::TEXT,
    jsonb_build_object(
      'nome', r.name,
      'horas', ROUND(SUM(EXTRACT(EPOCH FROM (
        COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time
      )) / 3600)::NUMERIC, 2),
      'taxa', ROUND((SUM(EXTRACT(EPOCH FROM (
        COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time
      )) / 3600) / (v_dias * v_horas_dia) * 100)::NUMERIC, 2)
    )
  ), '{}') INTO v_por_sala
  FROM rooms r
  LEFT JOIN room_occupancies ro ON ro.room_id = r.id 
    AND ro.start_time::DATE BETWEEN p_inicio AND p_fim
  WHERE r.tenant_id = p_tenant_id AND r.is_active = true
  GROUP BY r.id, r.name;
  
  RETURN QUERY SELECT 
    ROUND((v_horas_ocup / NULLIF(v_horas_disp, 0) * 100), 2),
    ROUND(v_horas_disp, 2),
    ROUND(v_horas_ocup, 2),
    v_por_sala;
END;
$$;


-- ============================================
-- Function: calc_retorno_nao_programado
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calc_retorno_nao_programado(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  taxa NUMERIC,
  retornos_7dias INTEGER,
  total_atend INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH atendimentos AS (
    SELECT 
      a.id,
      a.client_id,
      a.date,
      LAG(a.date) OVER (PARTITION BY a.client_id ORDER BY a.date) as data_anterior
    FROM appointments a
    WHERE a.tenant_id = p_tenant_id
      AND a.status = 'completed'
      AND a.date BETWEEN p_inicio AND p_fim
  )
  SELECT 
    ROUND((COUNT(*) FILTER (WHERE date - data_anterior <= 7)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as taxa,
    COUNT(*) FILTER (WHERE date - data_anterior <= 7)::INTEGER as retornos_7dias,
    COUNT(*)::INTEGER as total_atend
  FROM atendimentos;
END;
$$;


-- ============================================
-- Function: archive_client_clinical_data
-- Source: 20260324700000_cfm_retention_policy_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION archive_client_clinical_data(
  p_client_id UUID,
  p_export_pdf_url TEXT DEFAULT NULL,
  p_export_xml_url TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client RECORD;
  v_medical_records JSONB;
  v_prescriptions JSONB;
  v_triages JSONB;
  v_evolutions JSONB;
  v_archive_id UUID;
  v_data_hash TEXT;
  v_all_data JSONB;
BEGIN
  -- Busca dados do cliente
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  
  -- Verifica se pode arquivar (período de retenção expirado)
  IF v_client.retention_expires_at IS NULL OR v_client.retention_expires_at > CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é permitido arquivar: período de retenção ainda não expirou (expira em %)',
      COALESCE(TO_CHAR(v_client.retention_expires_at, 'DD/MM/YYYY'), 'data não definida');
  END IF;
  
  -- Coleta prontuários
  SELECT COALESCE(jsonb_agg(row_to_json(mr)), '[]'::JSONB)
  INTO v_medical_records
  FROM medical_records mr
  WHERE mr.client_id = p_client_id;
  
  -- Coleta prescrições
  SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::JSONB)
  INTO v_prescriptions
  FROM prescriptions p
  JOIN medical_records mr ON mr.id = p.medical_record_id
  WHERE mr.client_id = p_client_id;
  
  -- Coleta triagens
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
  INTO v_triages
  FROM triage_records t
  WHERE t.client_id = p_client_id;
  
  -- Coleta evoluções (se existir)
  v_evolutions := '[]'::JSONB;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_evolutions') THEN
    EXECUTE format('
      SELECT COALESCE(jsonb_agg(row_to_json(e)), ''[]''::JSONB)
      FROM clinical_evolutions e
      WHERE e.client_id = $1
    ') INTO v_evolutions USING p_client_id;
  END IF;
  
  -- Monta JSON completo para hash
  v_all_data := jsonb_build_object(
    'client', row_to_json(v_client),
    'medical_records', v_medical_records,
    'prescriptions', v_prescriptions,
    'triages', v_triages,
    'evolutions', v_evolutions
  );
  
  -- Gera hash de integridade
  v_data_hash := encode(sha256(v_all_data::TEXT::BYTEA), 'hex');
  
  -- Insere no arquivo
  INSERT INTO archived_clinical_data (
    tenant_id, client_id, client_name, client_cpf, client_cns, client_birth_date,
    medical_records, prescriptions, triages, evolutions,
    last_appointment_date, retention_expired_at, archived_by,
    export_pdf_url, export_xml_url, export_generated_at,
    data_hash, can_be_deleted_after
  ) VALUES (
    v_client.tenant_id, p_client_id, v_client.name, v_client.cpf, v_client.cns, v_client.birth_date,
    v_medical_records, v_prescriptions, v_triages, v_evolutions,
    v_client.last_appointment_date, v_client.retention_expires_at, auth.uid(),
    p_export_pdf_url, p_export_xml_url, 
    CASE WHEN p_export_pdf_url IS NOT NULL OR p_export_xml_url IS NOT NULL THEN NOW() ELSE NULL END,
    v_data_hash, CURRENT_DATE + INTERVAL '5 years'
  ) RETURNING id INTO v_archive_id;
  
  -- Remove dados originais (agora permitido pois passou do período)
  -- Primeiro remove dependências
  DELETE FROM prescriptions WHERE medical_record_id IN (
    SELECT id FROM medical_records WHERE client_id = p_client_id
  );
  DELETE FROM triage_records WHERE client_id = p_client_id;
  
  -- Remove evoluções se existir
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_evolutions') THEN
    EXECUTE 'DELETE FROM clinical_evolutions WHERE client_id = $1' USING p_client_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nursing_evolutions') THEN
    EXECUTE 'DELETE FROM nursing_evolutions WHERE client_id = $1' USING p_client_id;
  END IF;
  
  -- Remove prontuários
  DELETE FROM medical_records WHERE client_id = p_client_id;
  
  -- Marca cliente como arquivado (não exclui o cadastro básico)
  UPDATE clients 
  SET 
    notes = COALESCE(notes, '') || E'\n[ARQUIVADO em ' || TO_CHAR(NOW(), 'DD/MM/YYYY') || ' - ID: ' || v_archive_id || ']',
    updated_at = NOW()
  WHERE id = p_client_id;
  
  RETURN v_archive_id;
END;
$$;


-- ============================================
-- Function: get_archived_client_data
-- Source: 20260324700000_cfm_retention_policy_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_archived_client_data(
  p_tenant_id UUID,
  p_client_cpf TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL
) RETURNS TABLE (
  archive_id UUID,
  client_name TEXT,
  client_cpf TEXT,
  last_appointment DATE,
  archived_at TIMESTAMPTZ,
  has_pdf BOOLEAN,
  has_xml BOOLEAN,
  total_records INTEGER,
  data_hash TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acd.id as archive_id,
    acd.client_name,
    acd.client_cpf,
    acd.last_appointment_date as last_appointment,
    acd.archived_at,
    acd.export_pdf_url IS NOT NULL as has_pdf,
    acd.export_xml_url IS NOT NULL as has_xml,
    jsonb_array_length(acd.medical_records)::INTEGER as total_records,
    acd.data_hash
  FROM archived_clinical_data acd
  WHERE acd.tenant_id = p_tenant_id
    AND (p_client_cpf IS NULL OR acd.client_cpf = p_client_cpf)
    AND (p_client_name IS NULL OR acd.client_name ILIKE '%' || p_client_name || '%')
  ORDER BY acd.archived_at DESC;
END;
$$;


-- ============================================
-- Function: get_pending_returns
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_pending_returns(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  client_id UUID,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  professional_id UUID,
  professional_name TEXT,
  service_name TEXT,
  return_days INTEGER,
  return_date DATE,
  days_until_return INTEGER,
  days_overdue INTEGER,
  reason TEXT,
  status TEXT,
  notify_patient BOOLEAN,
  last_notification_at TIMESTAMPTZ,
  scheduled_appointment_id UUID,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.id,
    rr.client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.email as client_email,
    rr.professional_id,
    p.name as professional_name,
    s.name as service_name,
    rr.return_days,
    rr.return_date,
    (rr.return_date - CURRENT_DATE)::INTEGER as days_until_return,
    CASE WHEN rr.return_date < CURRENT_DATE 
      THEN (CURRENT_DATE - rr.return_date)::INTEGER 
      ELSE 0 
    END as days_overdue,
    rr.reason,
    rr.status,
    rr.notify_patient,
    rr.last_notification_at,
    rr.scheduled_appointment_id,
    rr.created_at
  FROM return_reminders rr
  JOIN clients c ON c.id = rr.client_id
  LEFT JOIN profiles p ON p.id = rr.professional_id
  LEFT JOIN services s ON s.id = rr.service_id
  WHERE rr.tenant_id = p_tenant_id
    AND (p_status IS NULL OR rr.status = p_status)
    AND (p_from_date IS NULL OR rr.return_date >= p_from_date)
    AND (p_to_date IS NULL OR rr.return_date <= p_to_date)
    AND (p_professional_id IS NULL OR rr.professional_id = p_professional_id)
  ORDER BY 
    CASE WHEN rr.status = 'pending' AND rr.return_date < CURRENT_DATE THEN 0 ELSE 1 END,
    rr.return_date ASC;
END;
$$;


-- ============================================
-- Function: get_returns_to_notify
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_returns_to_notify(p_tenant_id UUID)
RETURNS TABLE (
  reminder_id UUID,
  client_id UUID,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  professional_name TEXT,
  return_date DATE,
  days_until_return INTEGER,
  reason TEXT,
  preferred_contact TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.id as reminder_id,
    rr.client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.email as client_email,
    p.name as professional_name,
    rr.return_date,
    (rr.return_date - CURRENT_DATE)::INTEGER as days_until_return,
    rr.reason,
    rr.preferred_contact
  FROM return_reminders rr
  JOIN clients c ON c.id = rr.client_id
  LEFT JOIN profiles p ON p.id = rr.professional_id
  WHERE rr.tenant_id = p_tenant_id
    AND rr.status = 'pending'
    AND rr.notify_patient = true
    AND rr.return_date - rr.notify_days_before <= CURRENT_DATE
    AND rr.return_date >= CURRENT_DATE
    AND (rr.last_notification_at IS NULL OR rr.last_notification_at < CURRENT_DATE - INTERVAL '1 day')
  ORDER BY rr.return_date ASC;
END;
$$;


-- ============================================
-- Function: expire_old_returns
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION expire_old_returns(p_days_overdue INTEGER DEFAULT 30)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE return_reminders
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'notified')
    AND return_date < CURRENT_DATE - p_days_overdue;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================
-- Function: generate_call_number
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_call_number(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(call_number), 0) + 1 INTO v_number
  FROM patient_calls
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE = CURRENT_DATE;
  RETURN v_number;
END;
$$;


-- ============================================
-- Function: call_next_patient
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE FUNCTION public.call_next_patient(
  p_tenant_id UUID,
  p_room_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL
) RETURNS TABLE (
  call_id UUID,
  patient_id UUID,
  client_name TEXT,
  room_name TEXT,
  professional_name TEXT,
  call_number INTEGER,
  priority INTEGER,
  priority_label TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_call_id UUID;
  v_room_name TEXT;
  v_professional_name TEXT;
BEGIN
  IF p_room_id IS NOT NULL THEN
    SELECT r.name INTO v_room_name FROM clinic_rooms r WHERE r.id = p_room_id;
  END IF;
  IF p_professional_id IS NOT NULL THEN
    SELECT pr.full_name INTO v_professional_name FROM profiles pr WHERE pr.id = p_professional_id;
  END IF;

  SELECT pc.id INTO v_call_id
  FROM patient_calls pc
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND pc.created_at::DATE = CURRENT_DATE
    AND (p_room_id IS NULL OR pc.room_id = p_room_id OR pc.room_id IS NULL)
    AND (p_professional_id IS NULL OR pc.professional_id = p_professional_id OR pc.professional_id IS NULL)
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT 1;
  
  IF v_call_id IS NULL THEN RETURN; END IF;
  
  UPDATE patient_calls SET 
    status = 'calling',
    room_id = COALESCE(p_room_id, patient_calls.room_id),
    room_name = COALESCE(v_room_name, patient_calls.room_name),
    professional_id = COALESCE(p_professional_id, patient_calls.professional_id),
    professional_name = COALESCE(v_professional_name, patient_calls.professional_name),
    times_called = times_called + 1,
    first_called_at = COALESCE(first_called_at, NOW()),
    last_called_at = NOW(),
    updated_at = NOW()
  WHERE patient_calls.id = v_call_id;
  
  RETURN QUERY
  SELECT pc.id, pc.patient_id, c.name, pc.room_name, pc.professional_name,
    pc.call_number, pc.priority, pc.priority_label
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  WHERE pc.id = v_call_id;
END;
$$;


-- ============================================
-- Function: recall_patient
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.recall_patient(p_call_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE patient_calls SET
    times_called = times_called + 1,
    last_called_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id AND status = 'calling';
END;
$$;


-- ============================================
-- Function: get_current_call
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE FUNCTION public.get_current_call(p_tenant_id UUID)
RETURNS TABLE (
  call_id UUID,
  patient_id UUID,
  client_name TEXT,
  call_number INTEGER,
  room_name TEXT,
  professional_name TEXT,
  times_called INTEGER,
  last_called_at TIMESTAMPTZ,
  priority INTEGER,
  priority_label TEXT,
  appointment_id UUID
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id, pc.patient_id, c.name, pc.call_number,
    pc.room_name, pc.professional_name, pc.times_called, pc.last_called_at,
    pc.priority, pc.priority_label,
    pc.appointment_id
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'calling'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.last_called_at DESC
  LIMIT 1;
END;
$$;


-- ============================================
-- Function: is_dentist
-- Source: 20260325000001_odontograms_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.is_dentist(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND professional_type = 'dentista'::public.professional_type
  );
$$;


-- ============================================
-- Function: hc_recalc_tier
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.hc_recalc_tier(p_lifetime_earned integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_lifetime_earned >= 1000 THEN 'platinum'
    WHEN p_lifetime_earned >= 500  THEN 'gold'
    WHEN p_lifetime_earned >= 200  THEN 'silver'
    ELSE 'bronze'
  END;
$$;


-- ============================================
-- Function: hc_on_rating_submitted
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.hc_on_rating_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_appointment RECORD;
  v_patient_id uuid;
BEGIN
  -- Buscar dados do appointment
  SELECT a.tenant_id, a.client_id
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = NEW.appointment_id;

  IF v_appointment IS NULL THEN
    RETURN NEW;
  END IF;

  v_patient_id := v_appointment.client_id;

  FOR v_rule IN
    SELECT * FROM public.health_credits_rules
    WHERE tenant_id = v_appointment.tenant_id
      AND trigger_type = 'review'
      AND is_active = true
  LOOP
    -- Não premiar duplicado para mesmo appointment
    IF EXISTS (
      SELECT 1 FROM public.health_credits_transactions
      WHERE tenant_id = v_appointment.tenant_id
        AND patient_id = v_patient_id
        AND reference_type = 'review'
        AND reference_id = NEW.appointment_id
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public.award_health_credits(
      v_appointment.tenant_id,
      v_patient_id,
      v_rule.points,
      'Avaliação do atendimento',
      'review',
      NEW.appointment_id,
      v_rule.expiry_days,
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: hc_expire_credits
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.hc_expire_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec RECORD;
  v_expired_total integer := 0;
  v_remaining integer;
BEGIN
  -- Buscar transações earn expiradas que ainda têm créditos disponíveis
  FOR v_rec IN
    SELECT
      t.id,
      t.tenant_id,
      t.patient_id,
      t.amount AS original_amount,
      b.balance AS current_balance
    FROM public.health_credits_transactions t
    JOIN public.health_credits_balance b
      ON b.tenant_id = t.tenant_id AND b.patient_id = t.patient_id
    WHERE t.type = 'earn'
      AND t.expires_at IS NOT NULL
      AND t.expires_at < now()
      AND b.balance > 0
    ORDER BY t.expires_at ASC
    FOR UPDATE OF b
  LOOP
    -- Expirar no máximo o que o paciente tem de saldo
    v_remaining := LEAST(v_rec.original_amount, v_rec.current_balance);

    IF v_remaining <= 0 THEN
      -- Marcar como processado movendo expires_at para null
      UPDATE public.health_credits_transactions SET expires_at = NULL WHERE id = v_rec.id;
      CONTINUE;
    END IF;

    UPDATE public.health_credits_balance
    SET balance = GREATEST(balance - v_remaining, 0),
        updated_at = now()
    WHERE tenant_id = v_rec.tenant_id AND patient_id = v_rec.patient_id;

    INSERT INTO public.health_credits_transactions (
      tenant_id, patient_id, type, amount, balance_after,
      reason, reference_type, reference_id
    ) VALUES (
      v_rec.tenant_id,
      v_rec.patient_id,
      'expire',
      -v_remaining,
      GREATEST(v_rec.current_balance - v_remaining, 0),
      'Créditos expirados',
      'expiration',
      v_rec.id -- referência à transação original
    );

    -- Marcar transação original como processada
    UPDATE public.health_credits_transactions SET expires_at = NULL WHERE id = v_rec.id;

    v_expired_total := v_expired_total + v_remaining;
  END LOOP;

  RETURN v_expired_total;
END;
$$;


-- ============================================
-- Function: generate_plan_number
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_plan_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
  v_year TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.treatment_plans
  WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  RETURN 'PT-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;


-- ============================================
-- Function: set_plan_number
-- Source: 20260325100001_treatment_plans_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_plan_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan_number IS NULL THEN
    NEW.plan_number := public.generate_plan_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: update_override_updated_at
-- Source: 20260325300000_tenant_overrides_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_override_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: update_overdue_invoices
-- Source: 20260326100000_patient_portal_financial_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_invoices
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending' AND due_date < CURRENT_DATE;
END;
$$;


-- ============================================
-- Function: get_messages_for_patient
-- Source: 20260326200001_fix_patient_messages_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_messages_for_patient(
  p_client_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  sender_type text,
  sender_name text,
  content text,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_patient_tenant_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT p.tenant_id INTO v_tenant_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT c.tenant_id INTO v_patient_tenant_id
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_patient_tenant_id IS NULL OR v_patient_tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  -- Marcar mensagens do paciente como lidas
  UPDATE public.patient_messages pm
  SET read_at = now()
  WHERE pm.patient_id = p_client_id
    AND pm.sender_type = 'patient'
    AND pm.read_at IS NULL;

  RETURN QUERY
  SELECT 
    pm.id,
    pm.sender_type,
    pm.sender_name,
    pm.content,
    pm.read_at,
    pm.created_at
  FROM public.patient_messages pm
  WHERE pm.patient_id = p_client_id
  ORDER BY pm.created_at ASC
  LIMIT p_limit;
END;
$$;


-- ============================================
-- Function: lookup_cns_by_cpf
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION lookup_cns_by_cpf(p_cpf VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT cns FROM clients 
    WHERE cpf = p_cpf AND cns IS NOT NULL
    LIMIT 1
  );
END;
$$;


-- ============================================
-- Function: get_tenant_theme
-- Source: 20260329400000_ux_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_theme(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_theme JSON;
BEGIN
    SELECT json_build_object(
        'primary_h', COALESCE(primary_h, 174),
        'primary_s', COALESCE(primary_s, 72),
        'primary_l', COALESCE(primary_l, 38),
        'accent_h', COALESCE(accent_h, 210),
        'accent_s', COALESCE(accent_s, 80),
        'accent_l', COALESCE(accent_l, 55),
        'preset_name', COALESCE(preset_name, 'teal'),
        'logo_url', logo_url,
        'logo_dark_url', logo_dark_url,
        'favicon_url', favicon_url,
        'border_radius', COALESCE(border_radius, '1rem'),
        'font_family', COALESCE(font_family, 'default')
    ) INTO v_theme
    FROM tenant_theme_settings
    WHERE tenant_id = p_tenant_id;
    
    -- Return defaults if no custom theme
    IF v_theme IS NULL THEN
        v_theme := json_build_object(
            'primary_h', 174,
            'primary_s', 72,
            'primary_l', 38,
            'accent_h', 210,
            'accent_s', 80,
            'accent_l', 55,
            'preset_name', 'teal',
            'logo_url', NULL,
            'logo_dark_url', NULL,
            'favicon_url', NULL,
            'border_radius', '1rem',
            'font_family', 'default'
        );
    END IF;
    
    RETURN v_theme;
END;
$$;


-- ============================================
-- Function: upsert_tenant_theme
-- Source: 20260329400000_ux_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION upsert_tenant_theme(
    p_tenant_id UUID,
    p_primary_h INTEGER DEFAULT NULL,
    p_primary_s INTEGER DEFAULT NULL,
    p_primary_l INTEGER DEFAULT NULL,
    p_accent_h INTEGER DEFAULT NULL,
    p_accent_s INTEGER DEFAULT NULL,
    p_accent_l INTEGER DEFAULT NULL,
    p_preset_name TEXT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_logo_dark_url TEXT DEFAULT NULL,
    p_favicon_url TEXT DEFAULT NULL,
    p_border_radius TEXT DEFAULT NULL,
    p_font_family TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO tenant_theme_settings (
        tenant_id, primary_h, primary_s, primary_l,
        accent_h, accent_s, accent_l, preset_name,
        logo_url, logo_dark_url, favicon_url,
        border_radius, font_family
    ) VALUES (
        p_tenant_id,
        COALESCE(p_primary_h, 174),
        COALESCE(p_primary_s, 72),
        COALESCE(p_primary_l, 38),
        COALESCE(p_accent_h, 210),
        COALESCE(p_accent_s, 80),
        COALESCE(p_accent_l, 55),
        COALESCE(p_preset_name, 'teal'),
        p_logo_url,
        p_logo_dark_url,
        p_favicon_url,
        COALESCE(p_border_radius, '1rem'),
        COALESCE(p_font_family, 'default')
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        primary_h = COALESCE(p_primary_h, tenant_theme_settings.primary_h),
        primary_s = COALESCE(p_primary_s, tenant_theme_settings.primary_s),
        primary_l = COALESCE(p_primary_l, tenant_theme_settings.primary_l),
        accent_h = COALESCE(p_accent_h, tenant_theme_settings.accent_h),
        accent_s = COALESCE(p_accent_s, tenant_theme_settings.accent_s),
        accent_l = COALESCE(p_accent_l, tenant_theme_settings.accent_l),
        preset_name = COALESCE(p_preset_name, tenant_theme_settings.preset_name),
        logo_url = COALESCE(p_logo_url, tenant_theme_settings.logo_url),
        logo_dark_url = COALESCE(p_logo_dark_url, tenant_theme_settings.logo_dark_url),
        favicon_url = COALESCE(p_favicon_url, tenant_theme_settings.favicon_url),
        border_radius = COALESCE(p_border_radius, tenant_theme_settings.border_radius),
        font_family = COALESCE(p_font_family, tenant_theme_settings.font_family),
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;


-- ============================================
-- Function: upsert_patient
-- Source: 20260330300000_rename_clients_to_patients_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_patient(
  p_tenant_id UUID,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_cpf TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_marital_status TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_street_number TEXT DEFAULT NULL,
  p_complement TEXT DEFAULT NULL,
  p_neighborhood TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_allergies TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  -- Tentar encontrar paciente existente por CPF ou telefone
  IF p_cpf IS NOT NULL AND p_cpf <> '' THEN
    SELECT id INTO v_patient_id
    FROM public.patients
    WHERE tenant_id = p_tenant_id AND cpf = p_cpf
    LIMIT 1;
  END IF;

  IF v_patient_id IS NULL AND p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT id INTO v_patient_id
    FROM public.patients
    WHERE tenant_id = p_tenant_id AND phone = p_phone
    LIMIT 1;
  END IF;

  IF v_patient_id IS NOT NULL THEN
    -- Atualizar paciente existente
    UPDATE public.patients
    SET
      name = COALESCE(p_name, name),
      phone = COALESCE(p_phone, phone),
      email = COALESCE(p_email, email),
      notes = COALESCE(p_notes, notes),
      cpf = COALESCE(p_cpf, cpf),
      date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
      marital_status = COALESCE(p_marital_status, marital_status),
      zip_code = COALESCE(p_zip_code, zip_code),
      street = COALESCE(p_street, street),
      street_number = COALESCE(p_street_number, street_number),
      complement = COALESCE(p_complement, complement),
      neighborhood = COALESCE(p_neighborhood, neighborhood),
      city = COALESCE(p_city, city),
      state = COALESCE(p_state, state),
      allergies = COALESCE(p_allergies, allergies),
      updated_at = NOW()
    WHERE id = v_patient_id;
  ELSE
    -- Inserir novo paciente
    INSERT INTO public.patients (
      tenant_id, name, phone, email, notes, cpf,
      date_of_birth, marital_status, zip_code, street,
      street_number, complement, neighborhood, city, state, allergies
    )
    VALUES (
      p_tenant_id, p_name, p_phone, p_email, p_notes, p_cpf,
      p_date_of_birth, p_marital_status, p_zip_code, p_street,
      p_street_number, p_complement, p_neighborhood, p_city, p_state, p_allergies
    )
    RETURNING id INTO v_patient_id;
  END IF;

  RETURN v_patient_id;
END;
$$;


-- ============================================
-- Function: upsert_client
-- Source: 20260330300000_rename_clients_to_patients_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_client(
  p_tenant_id UUID,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_cpf TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_marital_status TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_street_number TEXT DEFAULT NULL,
  p_complement TEXT DEFAULT NULL,
  p_neighborhood TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_allergies TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.upsert_patient(
    p_tenant_id, p_name, p_phone, p_email, p_notes, p_cpf,
    p_date_of_birth, p_marital_status, p_zip_code, p_street,
    p_street_number, p_complement, p_neighborhood, p_city, p_state, p_allergies
  );
END;
$$;


-- ============================================
-- Function: set_server_timestamp
-- Source: 20260330800000_cfm_required_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_server_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.server_timestamp IS NULL THEN
    NEW.server_timestamp := NOW();
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: verify_document_public
-- Source: 20260401100001_fix_verify_document_public_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.verify_document_public(
  p_hash TEXT,
  p_verifier_ip INET DEFAULT NULL,
  p_verifier_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document RECORD;
  v_consent  RECORD;
  v_result   JSONB;
  v_is_valid BOOLEAN := false;
  v_patient_initials TEXT;
  v_doc_type TEXT;
  v_doc_id UUID;
  v_tenant_id UUID;
BEGIN
  -- 1. Buscar em documentos médicos (view existente)
  SELECT * INTO v_document
  FROM public.verifiable_documents
  WHERE hash = p_hash
  LIMIT 1;

  IF v_document IS NOT NULL THEN
    v_is_valid := v_document.is_signed;
    v_doc_type := v_document.document_type::text;
    v_doc_id   := v_document.document_id;
    v_tenant_id := v_document.tenant_id;

    SELECT
      CASE
        WHEN v_document.document_type::text = 'medical_certificate' THEN
          (SELECT CONCAT(LEFT(pat.full_name, 1), '.', LEFT(SPLIT_PART(pat.full_name, ' ', 2), 1), '.')
           FROM public.medical_certificates mc
           JOIN public.patients pat ON mc.patient_id = pat.id
           WHERE mc.id = v_document.document_id)
        WHEN v_document.document_type::text = 'prescription' THEN
          (SELECT CONCAT(LEFT(pat.full_name, 1), '.', LEFT(SPLIT_PART(pat.full_name, ' ', 2), 1), '.')
           FROM public.prescriptions pr
           JOIN public.patients pat ON pr.patient_id = pat.id
           WHERE pr.id = v_document.document_id)
        ELSE 'N/A'
      END INTO v_patient_initials;

    v_result := jsonb_build_object(
      'found', true,
      'valid', v_is_valid,
      'document_type', v_document.document_type,
      'doc_subtype', v_document.doc_subtype,
      'signed_at', v_document.signed_at,
      'signer_name', v_document.signer_name,
      'signer_crm', v_document.signer_crm,
      'signer_uf', v_document.signer_uf,
      'created_at', v_document.created_at,
      'patient_initials', v_patient_initials,
      'hash', p_hash,
      'message', CASE
        WHEN v_is_valid THEN 'Documento válido e assinado digitalmente'
        ELSE 'Documento encontrado mas não assinado'
      END
    );

  ELSE
    -- 2. Buscar em patient_consents (termos de consentimento selados)
    SELECT
      pc.id,
      pc.tenant_id,
      pc.patient_id,
      pc.signed_at,
      pc.sealed_at,
      pc.sealed_pdf_hash,
      pc.signature_method,
      ct.title AS template_title
    INTO v_consent
    FROM public.patient_consents pc
    LEFT JOIN public.consent_templates ct ON ct.id = pc.template_id
    WHERE pc.sealed_pdf_hash = p_hash
    LIMIT 1;

    IF v_consent IS NOT NULL THEN
      v_is_valid := v_consent.sealed_at IS NOT NULL;
      v_doc_type := 'consent';
      v_doc_id   := v_consent.id;
      v_tenant_id := v_consent.tenant_id;

      -- Iniciais do paciente (via patients)
      SELECT CONCAT(LEFT(p.full_name, 1), '.', LEFT(SPLIT_PART(p.full_name, ' ', 2), 1), '.')
      INTO v_patient_initials
      FROM public.patients p
      WHERE p.id = v_consent.patient_id;

      v_result := jsonb_build_object(
        'found', true,
        'valid', v_is_valid,
        'document_type', 'consent',
        'doc_subtype', COALESCE(v_consent.template_title, 'Termo de Consentimento'),
        'signed_at', v_consent.signed_at,
        'sealed_at', v_consent.sealed_at,
        'signature_method', v_consent.signature_method,
        'signer_name', null,
        'signer_crm', null,
        'signer_uf', null,
        'created_at', v_consent.signed_at,
        'patient_initials', v_patient_initials,
        'hash', p_hash,
        'message', CASE
          WHEN v_is_valid THEN 'Termo de consentimento válido — PDF selado digitalmente'
          ELSE 'Termo encontrado mas PDF ainda não foi selado'
        END
      );
    ELSE
      -- Nenhum documento encontrado
      v_result := jsonb_build_object(
        'found', false,
        'valid', false,
        'message', 'Documento não encontrado ou não assinado digitalmente'
      );
    END IF;
  END IF;

  -- Registrar verificação no log
  INSERT INTO public.document_verifications (
    document_type,
    document_id,
    document_hash,
    verification_result,
    verifier_ip,
    verifier_user_agent,
    tenant_id
  ) VALUES (
    COALESCE(v_doc_type, 'medical_certificate')::verifiable_document_type,
    COALESCE(v_doc_id, '00000000-0000-0000-0000-000000000000'::UUID),
    p_hash,
    v_is_valid,
    p_verifier_ip,
    p_verifier_user_agent,
    v_tenant_id
  );

  RETURN v_result;
END;
$$;


-- ============================================
-- Function: has_treated_patient
-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.has_treated_patient(p_user_id UUID, p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.profiles p ON p.id = a.professional_id
    WHERE p.user_id = p_user_id
      AND a.patient_id = p_patient_id
      AND a.status <> 'cancelled'
  );
$$;


-- ============================================
-- Function: check_rate_limit
-- Source: 20260720000000_dental_rpc_fixes_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_rpc_name TEXT,
  p_max_per_minute INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('minute', NOW());
  v_count INTEGER;
BEGIN
  -- Cleanup old windows (older than 5 minutes)
  DELETE FROM public.rpc_rate_limits 
  WHERE window_start < v_window - INTERVAL '5 minutes';
  
  -- Upsert current window
  INSERT INTO public.rpc_rate_limits (user_id, rpc_name, window_start, call_count)
  VALUES (p_user_id, p_rpc_name, v_window, 1)
  ON CONFLICT (user_id, rpc_name, window_start)
  DO UPDATE SET call_count = rpc_rate_limits.call_count + 1
  RETURNING call_count INTO v_count;
  
  RETURN v_count <= p_max_per_minute;
END;
$$;

