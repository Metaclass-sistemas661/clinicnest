-- Fase 18 - App Mobile / Push Notifications
-- Tabela para armazenar tokens FCM dos dispositivos

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Token FCM
  fcm_token TEXT NOT NULL,
  
  -- Informações do dispositivo
  device_name VARCHAR(100),
  platform VARCHAR(20), -- 'ios', 'android', 'web', 'windows', 'macos'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Preferências de notificação
  notify_appointments BOOLEAN DEFAULT true,
  notify_messages BOOLEAN DEFAULT true,
  notify_triagem BOOLEAN DEFAULT true,
  notify_reminders BOOLEAN DEFAULT true,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique por usuário + token
  UNIQUE(user_id, fcm_token)
);

-- Índices
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia suas subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

-- Tabela de histórico de notificações enviadas
CREATE TABLE IF NOT EXISTS push_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Destinatário
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  
  -- Conteúdo
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'clicked'
  error_message TEXT,
  
  -- Métricas
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX idx_push_log_tenant ON push_notifications_log(tenant_id);
CREATE INDEX idx_push_log_user ON push_notifications_log(user_id);
CREATE INDEX idx_push_log_date ON push_notifications_log(sent_at DESC);

ALTER TABLE push_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for push_log" ON push_notifications_log
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Função para buscar tokens ativos de um usuário
CREATE OR REPLACE FUNCTION get_user_fcm_tokens(p_user_id UUID)
RETURNS TABLE(fcm_token TEXT, platform VARCHAR, device_name VARCHAR)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT fcm_token, platform, device_name
  FROM push_subscriptions
  WHERE user_id = p_user_id
    AND is_active = true;
$$;

-- Função para buscar tokens de todos usuários de um tenant (para broadcasts)
CREATE OR REPLACE FUNCTION get_tenant_fcm_tokens(p_tenant_id UUID)
RETURNS TABLE(user_id UUID, fcm_token TEXT, platform VARCHAR)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT user_id, fcm_token, platform
  FROM push_subscriptions
  WHERE tenant_id = p_tenant_id
    AND is_active = true;
$$;

-- Comentários
COMMENT ON TABLE push_subscriptions IS 'Tokens FCM para push notifications';
COMMENT ON TABLE push_notifications_log IS 'Histórico de notificações enviadas';
