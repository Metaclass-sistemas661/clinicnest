-- ============================================================================
-- FASE 33D: Notificação Automática de Retorno
-- Adiciona suporte para notificações automáticas de retorno via WhatsApp/Email
-- ============================================================================

-- ─── 1. Adicionar campo notified_at na tabela return_reminders ──────────────

ALTER TABLE return_reminders 
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

COMMENT ON COLUMN return_reminders.notified_at IS 'Data/hora em que a notificação foi enviada';

-- ─── 2. Atualizar enum de status se necessário ──────────────────────────────

-- Verificar se o status 'notified' já existe
DO $$
BEGIN
  -- Adicionar 'notified' ao check constraint se não existir
  -- Primeiro, remover constraint existente
  ALTER TABLE return_reminders DROP CONSTRAINT IF EXISTS return_reminders_status_check;
  
  -- Adicionar nova constraint com 'notified'
  ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_status_check 
    CHECK (status IN ('pending', 'notified', 'scheduled', 'completed', 'cancelled'));
EXCEPTION
  WHEN others THEN
    -- Se falhar, a constraint pode não existir ou ter outro nome
    NULL;
END $$;

-- ─── 3. Tabela para tokens de confirmação de retorno ────────────────────────

CREATE TABLE IF NOT EXISTS return_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES return_reminders(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  action TEXT, -- 'confirmed', 'cancelled', 'rescheduled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT return_confirmation_tokens_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_return_confirmation_tokens_token ON return_confirmation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_return_confirmation_tokens_return ON return_confirmation_tokens(return_id);

-- ─── 4. Função para gerar token único ───────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_return_confirmation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ─── 5. RPC para criar link de confirmação ──────────────────────────────────

CREATE OR REPLACE FUNCTION create_return_confirmation_link(
  p_tenant_id UUID,
  p_return_id UUID,
  p_expires_hours INTEGER DEFAULT 72
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Verificar se o retorno existe e pertence ao tenant
  SELECT EXISTS(
    SELECT 1 FROM return_reminders
    WHERE id = p_return_id AND tenant_id = p_tenant_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Retorno não encontrado';
  END IF;
  
  -- Verificar se já existe um token válido
  SELECT token INTO v_token
  FROM return_confirmation_tokens
  WHERE return_id = p_return_id
    AND used_at IS NULL
    AND expires_at > NOW()
  LIMIT 1;
  
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;
  
  -- Gerar novo token
  v_token := generate_return_confirmation_token();
  
  -- Garantir unicidade
  WHILE EXISTS(SELECT 1 FROM return_confirmation_tokens WHERE token = v_token) LOOP
    v_token := generate_return_confirmation_token();
  END LOOP;
  
  -- Inserir token
  INSERT INTO return_confirmation_tokens (
    tenant_id,
    return_id,
    token,
    expires_at
  ) VALUES (
    p_tenant_id,
    p_return_id,
    v_token,
    NOW() + (p_expires_hours || ' hours')::INTERVAL
  );
  
  RETURN v_token;
END;
$$;

-- ─── 6. RPC para validar token de confirmação ───────────────────────────────

CREATE OR REPLACE FUNCTION validate_return_token(p_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  return_id UUID,
  tenant_id UUID,
  client_id UUID,
  client_name TEXT,
  professional_name TEXT,
  return_date DATE,
  reason TEXT,
  status TEXT,
  clinic_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Buscar token
  SELECT 
    rct.*,
    rr.client_id,
    rr.professional_id,
    rr.return_date,
    rr.reason,
    rr.status as return_status
  INTO v_token_record
  FROM return_confirmation_tokens rct
  JOIN return_reminders rr ON rr.id = rct.return_id
  WHERE rct.token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::BOOLEAN, 
      NULL::UUID, NULL::UUID, NULL::UUID, 
      NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Verificar se expirou ou já foi usado
  IF v_token_record.expires_at < NOW() OR v_token_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN, 
      NULL::UUID, NULL::UUID, NULL::UUID, 
      NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Buscar dados adicionais
  RETURN QUERY
  SELECT 
    true::BOOLEAN as valid,
    v_token_record.return_id,
    v_token_record.tenant_id,
    v_token_record.client_id,
    c.name::TEXT as client_name,
    COALESCE(p.full_name, '')::TEXT as professional_name,
    v_token_record.return_date,
    v_token_record.reason::TEXT,
    v_token_record.return_status::TEXT as status,
    t.name::TEXT as clinic_name
  FROM clients c
  LEFT JOIN profiles p ON p.id = v_token_record.professional_id
  LEFT JOIN tenants t ON t.id = v_token_record.tenant_id
  WHERE c.id = v_token_record.client_id;
END;
$$;

-- ─── 7. RPC para confirmar retorno via token ────────────────────────────────

CREATE OR REPLACE FUNCTION confirm_return_via_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Buscar e validar token
  SELECT rct.*, rr.status as return_status
  INTO v_token_record
  FROM return_confirmation_tokens rct
  JOIN return_reminders rr ON rr.id = rct.return_id
  WHERE rct.token = p_token
    AND rct.expires_at > NOW()
    AND rct.used_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Marcar token como usado
  UPDATE return_confirmation_tokens
  SET used_at = NOW(), action = 'confirmed'
  WHERE id = v_token_record.id;
  
  -- Atualizar status do retorno para 'scheduled' (confirmado pelo paciente)
  UPDATE return_reminders
  SET status = 'scheduled'
  WHERE id = v_token_record.return_id;
  
  RETURN true;
END;
$$;

-- ─── 8. RPC para cancelar retorno via token ─────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_return_via_token(p_token TEXT, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Buscar e validar token
  SELECT rct.*, rr.status as return_status
  INTO v_token_record
  FROM return_confirmation_tokens rct
  JOIN return_reminders rr ON rr.id = rct.return_id
  WHERE rct.token = p_token
    AND rct.expires_at > NOW()
    AND rct.used_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Marcar token como usado
  UPDATE return_confirmation_tokens
  SET used_at = NOW(), action = 'cancelled'
  WHERE id = v_token_record.id;
  
  -- Atualizar status do retorno para 'cancelled'
  UPDATE return_reminders
  SET 
    status = 'cancelled',
    notes = COALESCE(notes || E'\n', '') || 'Cancelado pelo paciente' || 
            CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END
  WHERE id = v_token_record.return_id;
  
  RETURN true;
END;
$$;

-- ─── 9. RLS para return_confirmation_tokens ─────────────────────────────────

ALTER TABLE return_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados do tenant
CREATE POLICY "return_confirmation_tokens_tenant_access" ON return_confirmation_tokens
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Política para acesso anônimo (validação de token)
CREATE POLICY "return_confirmation_tokens_anon_select" ON return_confirmation_tokens
  FOR SELECT
  TO anon
  USING (true);

-- ─── 10. Grants ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION create_return_confirmation_link(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_return_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_return_via_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_return_via_token(TEXT, TEXT) TO anon, authenticated;

-- ─── 11. Índices adicionais para performance ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_return_reminders_status_date 
  ON return_reminders(tenant_id, status, return_date);

CREATE INDEX IF NOT EXISTS idx_return_reminders_notified 
  ON return_reminders(tenant_id, status) 
  WHERE status = 'pending' AND notified_at IS NULL;

-- ─── 12. Comentários ────────────────────────────────────────────────────────

COMMENT ON TABLE return_confirmation_tokens IS 'Tokens para confirmação de retorno via link público';
COMMENT ON FUNCTION create_return_confirmation_link IS 'Cria um link único para o paciente confirmar/cancelar retorno';
COMMENT ON FUNCTION validate_return_token IS 'Valida token e retorna dados do retorno';
COMMENT ON FUNCTION confirm_return_via_token IS 'Confirma retorno via token público';
COMMENT ON FUNCTION cancel_return_via_token IS 'Cancela retorno via token público';
