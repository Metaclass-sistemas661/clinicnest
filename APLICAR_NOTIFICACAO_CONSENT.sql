-- ═══════════════════════════════════════════════════════════════════
-- APLICAR NO SUPABASE SQL EDITOR
-- Notificações no portal do paciente para consentimentos
-- ═══════════════════════════════════════════════════════════════════
--
-- O QUE FAZ:
--   1. Quando um documento é criado PENDENTE → notificação "Novo documento para assinar"
--   2. Quando um documento é ASSINADO → notificação "Documento assinado ✅"
--
-- COMO APLICAR:
--   1. Abra o Supabase Dashboard → SQL Editor
--   2. Cole este script inteiro
--   3. Clique em "Run"
-- ═══════════════════════════════════════════════════════════════════

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
  -- Resolve user_id do paciente
  v_user_id := NEW.patient_user_id;
  IF v_user_id IS NULL THEN
    SELECT pp.user_id INTO v_user_id
    FROM public.patient_profiles pp
    WHERE pp.client_id = NEW.patient_id
      AND pp.tenant_id = NEW.tenant_id
      AND pp.is_active = true
    LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(ct.title, 'Documento') INTO v_template
  FROM public.consent_templates ct WHERE ct.id = NEW.template_id;

  SELECT COALESCE(t.name, '') INTO v_clinic_name
  FROM public.tenants t WHERE t.id = NEW.tenant_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.signed_at IS NOT NULL THEN
      v_type  := 'consent_signed';
      v_title := 'Documento assinado ✅';
      v_body  := format('O termo "%s" foi assinado com sucesso.', v_template);
      v_metadata := jsonb_build_object(
        'consent_id', NEW.id, 'template_id', NEW.template_id,
        'template_title', v_template, 'clinic_name', v_clinic_name,
        'signed_at', NEW.signed_at
      );
    ELSE
      v_type  := 'consent_pending';
      v_title := 'Novo documento para assinar 📋';
      v_body  := format('O termo "%s" está aguardando sua assinatura.', v_template);
      v_metadata := jsonb_build_object(
        'consent_id', NEW.id, 'template_id', NEW.template_id,
        'template_title', v_template, 'clinic_name', v_clinic_name
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.signed_at IS NULL AND NEW.signed_at IS NOT NULL THEN
      v_type  := 'consent_signed';
      v_title := 'Documento assinado ✅';
      v_body  := format('O termo "%s" foi assinado com sucesso.', v_template);
      v_metadata := jsonb_build_object(
        'consent_id', NEW.id, 'template_id', NEW.template_id,
        'template_title', v_template, 'clinic_name', v_clinic_name,
        'signed_at', NEW.signed_at
      );
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)
  VALUES (v_user_id, v_type, v_title, v_body, v_metadata);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_consent_insert ON public.patient_consents;
CREATE TRIGGER trg_notify_patient_consent_insert
  AFTER INSERT ON public.patient_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_patient_consent();

DROP TRIGGER IF EXISTS trg_notify_patient_consent_update ON public.patient_consents;
CREATE TRIGGER trg_notify_patient_consent_update
  AFTER UPDATE ON public.patient_consents
  FOR EACH ROW
  WHEN (OLD.signed_at IS NULL AND NEW.signed_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_patient_consent();
