-- ============================================================================
-- Migration: Notificações de agendamento confirmado pela clínica
-- 
-- Implementa o fluxo completo de notificação ao paciente quando a clínica
-- confirma um agendamento:
--   1. Adiciona 'appointment_confirmed' ao CHECK constraint de automations
--   2. Cria trigger no appointments para notificar via patient_notifications
--   3. Seed template de automação para WhatsApp/Email/SMS
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Expandir constraint de trigger_type para incluir appointment_confirmed
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_type_check
  CHECK (trigger_type IN (
    'appointment_created',
    'appointment_confirmed',
    'appointment_reminder_24h',
    'appointment_reminder_2h',
    'appointment_completed',
    'appointment_cancelled',
    'birthday',
    'client_inactive_days',
    'return_reminder',
    'consent_signed',
    'return_scheduled',
    'invoice_created',
    'exam_ready'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger: notificar paciente no portal quando agendamento é confirmado
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_patient_appointment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id UUID;
  v_prof_name TEXT;
  v_clinic_name TEXT;
  v_procedure_name TEXT;
  v_scheduled TEXT;
BEGIN
  -- Só dispara quando status muda para 'confirmed' a partir de 'pending'
  IF NEW.status != 'confirmed' OR OLD.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Buscar user_id do paciente via patient_profiles
  SELECT pp.user_id INTO v_patient_user_id
  FROM public.patient_profiles pp
  WHERE pp.client_id = NEW.patient_id
    AND pp.tenant_id = NEW.tenant_id
    AND pp.is_active = true
  LIMIT 1;

  -- Se o paciente não tem conta no portal, não faz nada
  IF v_patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar dados para a notificação
  SELECT COALESCE(p.full_name, 'Profissional') INTO v_prof_name
  FROM public.profiles p
  WHERE p.id = NEW.professional_id;

  SELECT COALESCE(t.name, 'Clínica') INTO v_clinic_name
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  SELECT COALESCE(proc.name, 'Consulta') INTO v_procedure_name
  FROM public.procedures proc
  WHERE proc.id = NEW.procedure_id;

  v_scheduled := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');

  -- Inserir notificação no portal do paciente
  INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)
  VALUES (
    v_patient_user_id,
    'appointment_confirmed',
    'Agendamento confirmado! ✅',
    format('Seu agendamento de %s com %s em %s foi confirmado pela clínica %s.',
      v_procedure_name, v_prof_name, v_scheduled, v_clinic_name
    ),
    jsonb_build_object(
      'appointment_id', NEW.id,
      'procedure_name', v_procedure_name,
      'professional_name', v_prof_name,
      'clinic_name', v_clinic_name,
      'scheduled_at', NEW.scheduled_at
    )
  );

  RAISE LOG 'notify_patient_appointment_confirmed: patient_user=% appointment=%', v_patient_user_id, NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_appointment_confirmed ON public.appointments;
CREATE TRIGGER trg_notify_patient_appointment_confirmed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.notify_patient_appointment_confirmed();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seed template de automação: confirmação por WhatsApp para cada tenant
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.automations (tenant_id, name, trigger_type, trigger_config, channel, message_template, is_active)
SELECT
  t.id,
  'Confirmação de agendamento (WhatsApp)',
  'appointment_confirmed',
  '{}'::jsonb,
  'whatsapp',
  'Olá {{patient_name}}! ✅ Seu agendamento foi confirmado pela clínica {{clinic_name}}.\n\n📋 *{{procedure_name}}*\n👨‍⚕️ {{professional_name}}\n📅 {{date}}\n⏰ {{time}}\n\nCaso precise reagendar, entre em contato conosco.',
  true
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.automations a
  WHERE a.tenant_id = t.id
    AND a.trigger_type = 'appointment_confirmed'
    AND a.channel = 'whatsapp'
);

-- Seed template email
INSERT INTO public.automations (tenant_id, name, trigger_type, trigger_config, channel, message_template, is_active)
SELECT
  t.id,
  'Confirmação de agendamento (Email)',
  'appointment_confirmed',
  '{}'::jsonb,
  'email',
  'Olá {{patient_name}}! ✅ Seu agendamento de {{procedure_name}} com {{professional_name}} para {{date}} às {{time}} foi confirmado pela clínica {{clinic_name}}. Caso precise reagendar, entre em contato.',
  true
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.automations a
  WHERE a.tenant_id = t.id
    AND a.trigger_type = 'appointment_confirmed'
    AND a.channel = 'email'
);

-- Seed template SMS
INSERT INTO public.automations (tenant_id, name, trigger_type, trigger_config, channel, message_template, is_active)
SELECT
  t.id,
  'Confirmação de agendamento (SMS)',
  'appointment_confirmed',
  '{}'::jsonb,
  'sms',
  'Agendamento confirmado! {{procedure_name}} com {{professional_name}} em {{date}} as {{time}}. {{clinic_name}}',
  true
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.automations a
  WHERE a.tenant_id = t.id
    AND a.trigger_type = 'appointment_confirmed'
    AND a.channel = 'sms'
);
