-- ============================================================================
-- FIX COMPLETO: Corrigir TODOS os triggers que ainda usam NEW.client_id
-- após a migração 20260330300000 (rename client_id → patient_id).
--
-- Este script é idempotente (CREATE OR REPLACE) e corrige:
--   1. notify_patient()                — trigger em medical_certificates, prescriptions, exam_results
--   2. trigger_notify_consent_signed() — trigger em patient_consents
--   3. trigger_notify_return_scheduled()— trigger em return_reminders
-- ============================================================================

-- ============================================================================
-- 1. FIX notify_patient() — trigger AFTER INSERT em medical_certificates,
--    prescriptions e exam_results.
--    PROBLEMA: usava NEW.client_id, mas a coluna agora é patient_id.
--    NOTA: patient_profiles.client_id NÃO foi renomeado (é a coluna bridge).
-- ============================================================================
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

-- ============================================================================
-- 2. FIX trigger_notify_consent_signed() — trigger em patient_consents
--    PROBLEMA: usava NEW.client_id como recipient_id, mas patient_consents
--    teve client_id renomeado para patient_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_notify_consent_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_logs (
    tenant_id,
    recipient_type,
    recipient_id,
    channel,
    template_type,
    status,
    metadata
  ) VALUES (
    NEW.tenant_id,
    'patient',
    NEW.patient_id,
    'all',
    'consent_signed',
    'queued',
    jsonb_build_object(
      'consent_id', NEW.id,
      'template_id', NEW.template_id
    )
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. FIX trigger_notify_return_scheduled() — trigger em return_reminders
--    PROBLEMA: usava NEW.client_id como recipient_id, mas return_reminders
--    teve client_id renomeado para patient_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_notify_return_scheduled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_logs (
    tenant_id,
    recipient_type,
    recipient_id,
    channel,
    template_type,
    status,
    metadata
  ) VALUES (
    NEW.tenant_id,
    'patient',
    NEW.patient_id,
    'all',
    'return_scheduled',
    'queued',
    jsonb_build_object(
      'return_id', NEW.id,
      'return_date', NEW.return_date,
      'reason', NEW.reason
    )
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- VERIFICAÇÃO: Confirmar que não há mais referências a NEW.client_id
-- nos triggers que disparam em tabelas com coluna renomeada.
-- Tabelas COM patient_id (renomeado): medical_certificates, prescriptions,
--   exam_results, appointments, medical_records, patient_consents,
--   return_reminders, referrals, etc.
-- Tabelas COM client_id (NÃO renomeado): patient_profiles, 
--   patient_notification_preferences, chatbot_conversations.
-- ============================================================================
