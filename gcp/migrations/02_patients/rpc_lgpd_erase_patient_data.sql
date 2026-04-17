CREATE OR REPLACE FUNCTION public.lgpd_erase_patient_data(p_tenant_id uuid, p_patient_id uuid, p_confirmation_token text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester UUID := current_setting('app.current_user_id')::uuid;

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

  -- ÔöÇÔöÇ 1. Valida├º├úo de seguran├ºa ÔöÇÔöÇ

  IF v_requester IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF NOT public.is_tenant_admin(v_requester, p_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem executar exclus├úo de dados de paciente';

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

    RAISE EXCEPTION 'Paciente n├úo encontrado neste tenant';

  END IF;



  -- ÔöÇÔöÇ 2. Confirma├º├úo por token (prote├º├úo contra chamada acidental) ÔöÇÔöÇ

  v_expected_token := 'ERASE_PATIENT:' || p_patient_id::text;

  IF COALESCE(p_confirmation_token, '') <> v_expected_token THEN

    RAISE EXCEPTION 'Token de confirma├º├úo inv├ílido. Esperado: ERASE_PATIENT:<patient_id>';

  END IF;



  -- ÔöÇÔöÇ 3. Hash irrevers├¡vel para pseudonimiza├º├úo ÔöÇÔöÇ

  v_anonymized_name := 'PACIENTE ANONIMIZADO #' || left(encode(digest(p_patient_id::text || now()::text, 'sha256'), 'hex'), 8);



  -- ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

  -- DELE├ç├âO F├ìSICA (dados sem obriga├º├úo legal de reten├º├úo)

  -- ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ



  -- 3a. Audit logs de navega├º├úo/acesso (n├úo exigidos por CFM)

  DELETE FROM public.audit_logs

  WHERE tenant_id = p_tenant_id

    AND entity_type = 'patients'

    AND entity_id = p_patient_id::text;

  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;



  -- 3b. Notifica├º├Áes push/in-app do paciente (se houver user_id vinculado)

  DELETE FROM public.notifications

  WHERE tenant_id = p_tenant_id

    AND metadata->>'patient_id' = p_patient_id::text;

  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;



  -- ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

  -- ANONIMIZA├ç├âO (dados cl├¡nicos retidos 20 anos ÔÇö CFM 1821/07)

  -- Elimina├º├úo de PII; estrutura cl├¡nica preservada.

  -- ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ



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

    -- Manter: date_of_birth (apenas ano, para estat├¡sticas et├írias)

    date_of_birth = CASE

      WHEN date_of_birth IS NOT NULL

      THEN make_date(extract(year FROM date_of_birth)::int, 1, 1)

      ELSE NULL

    END,

    updated_at = now()

  WHERE id = p_patient_id

    AND tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_patient_updated = ROW_COUNT;



  -- 5. Prontu├írios: limpar texto livre que possa conter nomes/contextos pessoais

  --    Preservar: diagn├│stico, CID, plano terap├¬utico (valor cl├¡nico-cient├¡fico)

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



  -- 6. Prescri├º├Áes: manter medica├º├Áes (dados cl├¡nicos), limpar instru├º├Áes pessoais

  UPDATE public.prescriptions

  SET

    instructions = NULL,

    -- Manter: medications, prescription_type, status, digital_signature

    updated_at = now()

  WHERE tenant_id = p_tenant_id

    AND patient_id = p_patient_id;

  GET DIAGNOSTICS v_prescriptions_anonymized = ROW_COUNT;



  -- 7. Atestados: anonimizar conte├║do textual

  UPDATE public.medical_certificates

  SET

    content = '** CONTE├ÜDO ANONIMIZADO **',

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



  -- 9. Encaminhamentos: anonimizar resumo cl├¡nico

  UPDATE public.referrals

  SET

    clinical_summary = NULL,

    reason = '** ANONIMIZADO **',

    updated_at = now()

  WHERE tenant_id = p_tenant_id

    AND patient_id = p_patient_id;

  GET DIAGNOSTICS v_referrals_anonymized = ROW_COUNT;



  -- 10. Evolu├º├Áes cl├¡nicas: anonimizar SOAP + notas

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



  -- ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

  -- AUDITORIA E TRACKING

  -- ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ



  -- 12. Marcar lgpd_data_request como conclu├¡da (se fornecida)

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



  -- 13. Log de auditoria com resumo completo (este log N├âO cont├®m PII)

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

$function$;