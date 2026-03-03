-- ============================================================================
-- SISTEMA DE NOTIFICAÇÕES V2 — Multi-canal (Email + SMS + WhatsApp + Chatbot)
-- ============================================================================

-- 1) SMS settings no tenant
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS sms_provider TEXT DEFAULT 'zenvia',
  ADD COLUMN IF NOT EXISTS sms_api_key TEXT,
  ADD COLUMN IF NOT EXISTS sms_sender TEXT;

-- 2) Expandir constraint de canal para incluir SMS
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_channel_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'sms'));

-- 3) Expandir constraint de gatilho para novos tipos
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_type_check
  CHECK (trigger_type IN (
    'appointment_created',
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

-- 4) Preferências de notificação do PACIENTE (qual canal aceita)
CREATE TABLE IF NOT EXISTS public.patient_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Granular opt-out por tipo
  opt_out_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_notif_prefs_client
  ON public.patient_notification_preferences(client_id);
CREATE INDEX IF NOT EXISTS idx_patient_notif_prefs_tenant
  ON public.patient_notification_preferences(tenant_id);

ALTER TABLE public.patient_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view patient prefs" ON public.patient_notification_preferences;
CREATE POLICY "Tenant members can view patient prefs"
  ON public.patient_notification_preferences FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can upsert patient prefs" ON public.patient_notification_preferences;
CREATE POLICY "Tenant members can upsert patient prefs"
  ON public.patient_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant members can update patient prefs" ON public.patient_notification_preferences;
CREATE POLICY "Tenant members can update patient prefs"
  ON public.patient_notification_preferences FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- 5) Tabela de logs de notificação (se não existe)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL DEFAULT 'patient',
  recipient_id UUID,
  channel TEXT NOT NULL,
  template_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant
  ON public.notification_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient
  ON public.notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
  ON public.notification_logs(status);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view notification logs" ON public.notification_logs;
CREATE POLICY "Tenant members can view notification logs"
  ON public.notification_logs FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Service role can insert notification logs" ON public.notification_logs;
CREATE POLICY "Service role can insert notification logs"
  ON public.notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Permitir service_role inserir sem RLS
ALTER TABLE public.notification_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role bypass notification logs" ON public.notification_logs;
CREATE POLICY "Service role bypass notification logs"
  ON public.notification_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6) Conversas do chatbot WhatsApp
CREATE TABLE IF NOT EXISTS public.chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  client_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  context JSONB NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_conv_tenant_phone
  ON public.chatbot_conversations(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_state
  ON public.chatbot_conversations(state);
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_updated
  ON public.chatbot_conversations(updated_at);

ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view chatbot conversations" ON public.chatbot_conversations;
CREATE POLICY "Tenant members can view chatbot conversations"
  ON public.chatbot_conversations FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Service role bypass chatbot conversations" ON public.chatbot_conversations;
CREATE POLICY "Service role bypass chatbot conversations"
  ON public.chatbot_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7) Mensagens do chatbot
CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_msg_conv
  ON public.chatbot_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chatbot_msg_tenant
  ON public.chatbot_messages(tenant_id, created_at DESC);

ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view chatbot messages" ON public.chatbot_messages;
CREATE POLICY "Tenant members can view chatbot messages"
  ON public.chatbot_messages FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Service role bypass chatbot messages" ON public.chatbot_messages;
CREATE POLICY "Service role bypass chatbot messages"
  ON public.chatbot_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8) Configuração do chatbot por tenant
CREATE TABLE IF NOT EXISTS public.chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  welcome_message TEXT NOT NULL DEFAULT 'Olá! 👋 Bem-vindo(a) à nossa clínica. Como posso ajudá-lo(a)?',
  menu_message TEXT NOT NULL DEFAULT 'Escolha uma opção:',
  outside_hours_message TEXT NOT NULL DEFAULT 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que retornaremos assim que possível.',
  business_hours_start TIME NOT NULL DEFAULT '08:00',
  business_hours_end TIME NOT NULL DEFAULT '18:00',
  business_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  auto_confirm_booking BOOLEAN NOT NULL DEFAULT false,
  max_future_days INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins manage chatbot settings" ON public.chatbot_settings;
CREATE POLICY "Tenant admins manage chatbot settings"
  ON public.chatbot_settings FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Service role bypass chatbot settings" ON public.chatbot_settings;
CREATE POLICY "Service role bypass chatbot settings"
  ON public.chatbot_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 9) Função auxiliar: enviar notificação em todos os canais habilitados
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

GRANT EXECUTE ON FUNCTION public.notify_patient_multi_channel(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_patient_multi_channel(UUID, UUID, TEXT, JSONB) TO service_role;

-- 10) Trigger para notificar quando consent é assinado
CREATE OR REPLACE FUNCTION public.trigger_notify_consent_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insere na fila de notificações para processamento
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
    NEW.client_id,
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

DROP TRIGGER IF EXISTS trg_notify_consent_signed ON public.patient_consents;
CREATE TRIGGER trg_notify_consent_signed
  AFTER INSERT ON public.patient_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_consent_signed();

-- 11) Trigger para notificar quando retorno é agendado
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
    NEW.client_id,
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

DROP TRIGGER IF EXISTS trg_notify_return_scheduled ON public.return_reminders;
CREATE TRIGGER trg_notify_return_scheduled
  AFTER INSERT ON public.return_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_return_scheduled();

-- 12) Grants
GRANT SELECT, INSERT, UPDATE ON public.patient_notification_preferences TO authenticated;
GRANT ALL ON public.patient_notification_preferences TO service_role;
GRANT SELECT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
GRANT SELECT ON public.chatbot_conversations TO authenticated;
GRANT ALL ON public.chatbot_conversations TO service_role;
GRANT SELECT ON public.chatbot_messages TO authenticated;
GRANT ALL ON public.chatbot_messages TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.chatbot_settings TO authenticated;
GRANT ALL ON public.chatbot_settings TO service_role;
