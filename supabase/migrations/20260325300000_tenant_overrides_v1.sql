-- =====================================================
-- FASE 28A — Sistema de Overrides Administrativos
-- =====================================================
-- Permite que super-admins liberem funcionalidades ou
-- ajustem limites para tenants específicos, independente
-- do plano contratado.
-- =====================================================

-- Tabela de overrides de funcionalidades
CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  enabled_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

-- Tabela de overrides de limites
CREATE TABLE IF NOT EXISTS tenant_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  custom_value INTEGER NOT NULL,
  reason TEXT,
  enabled_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, limit_key)
);

-- Tabela de auditoria de overrides
CREATE TABLE IF NOT EXISTS override_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('feature', 'limit')),
  override_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'expired')),
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_tenant 
  ON tenant_feature_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_feature 
  ON tenant_feature_overrides(tenant_id, feature_key);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_expires 
  ON tenant_feature_overrides(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_limit_overrides_tenant 
  ON tenant_limit_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_limit_overrides_limit 
  ON tenant_limit_overrides(tenant_id, limit_key);
CREATE INDEX IF NOT EXISTS idx_tenant_limit_overrides_expires 
  ON tenant_limit_overrides(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_override_audit_log_tenant 
  ON override_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_override_audit_log_override 
  ON override_audit_log(override_type, override_id);

-- RLS Policies
ALTER TABLE tenant_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_limit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE override_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenant pode ver seus próprios overrides
CREATE POLICY "tenant_feature_overrides_select" ON tenant_feature_overrides
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_limit_overrides_select" ON tenant_limit_overrides
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Apenas super-admin pode modificar (via service role ou RPC específica)
-- Por segurança, não criamos policies de INSERT/UPDATE/DELETE aqui
-- Essas operações serão feitas via RPCs com SECURITY DEFINER

-- Tenant pode ver auditoria dos seus overrides
CREATE POLICY "override_audit_log_select" ON override_audit_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- =====================================================
-- RPC: get_tenant_overrides
-- Retorna overrides ativos (não expirados) para o tenant
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_overrides()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSON;
BEGIN
  -- Obter tenant_id do usuário autenticado
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('features', '[]'::json, 'limits', '[]'::json);
  END IF;

  SELECT json_build_object(
    'features', COALESCE((
      SELECT json_agg(json_build_object(
        'id', id,
        'feature_key', feature_key,
        'is_enabled', is_enabled,
        'reason', reason,
        'expires_at', expires_at
      ))
      FROM tenant_feature_overrides
      WHERE tenant_id = v_tenant_id
        AND (expires_at IS NULL OR expires_at > now())
    ), '[]'::json),
    'limits', COALESCE((
      SELECT json_agg(json_build_object(
        'id', id,
        'limit_key', limit_key,
        'custom_value', custom_value,
        'reason', reason,
        'expires_at', expires_at
      ))
      FROM tenant_limit_overrides
      WHERE tenant_id = v_tenant_id
        AND (expires_at IS NULL OR expires_at > now())
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: create_feature_override (apenas super-admin)
-- =====================================================
CREATE OR REPLACE FUNCTION create_feature_override(
  p_tenant_id UUID,
  p_feature_key TEXT,
  p_is_enabled BOOLEAN DEFAULT true,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
BEGIN
  -- Verificar se o usuário é super-admin (implementar lógica específica)
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Inserir ou atualizar override
  INSERT INTO tenant_feature_overrides (
    tenant_id, feature_key, is_enabled, reason, enabled_by, expires_at
  ) VALUES (
    p_tenant_id, p_feature_key, p_is_enabled, p_reason, v_actor_id, p_expires_at
  )
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    reason = EXCLUDED.reason,
    enabled_by = EXCLUDED.enabled_by,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING id INTO v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, new_value, changed_by
  ) VALUES (
    p_tenant_id, 'feature', v_override_id, 'created',
    json_build_object(
      'feature_key', p_feature_key,
      'is_enabled', p_is_enabled,
      'reason', p_reason,
      'expires_at', p_expires_at
    ),
    v_actor_id
  );

  RETURN v_override_id;
END;
$$;

-- =====================================================
-- RPC: create_limit_override (apenas super-admin)
-- =====================================================
CREATE OR REPLACE FUNCTION create_limit_override(
  p_tenant_id UUID,
  p_limit_key TEXT,
  p_custom_value INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
BEGIN
  -- Verificar se o usuário é super-admin (implementar lógica específica)
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Inserir ou atualizar override
  INSERT INTO tenant_limit_overrides (
    tenant_id, limit_key, custom_value, reason, enabled_by, expires_at
  ) VALUES (
    p_tenant_id, p_limit_key, p_custom_value, p_reason, v_actor_id, p_expires_at
  )
  ON CONFLICT (tenant_id, limit_key) DO UPDATE SET
    custom_value = EXCLUDED.custom_value,
    reason = EXCLUDED.reason,
    enabled_by = EXCLUDED.enabled_by,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING id INTO v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, new_value, changed_by
  ) VALUES (
    p_tenant_id, 'limit', v_override_id, 'created',
    json_build_object(
      'limit_key', p_limit_key,
      'custom_value', p_custom_value,
      'reason', p_reason,
      'expires_at', p_expires_at
    ),
    v_actor_id
  );

  RETURN v_override_id;
END;
$$;

-- =====================================================
-- RPC: delete_feature_override
-- =====================================================
CREATE OR REPLACE FUNCTION delete_feature_override(
  p_tenant_id UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
  v_old_value JSONB;
BEGIN
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Buscar override existente
  SELECT id, json_build_object(
    'feature_key', feature_key,
    'is_enabled', is_enabled,
    'reason', reason,
    'expires_at', expires_at
  )::jsonb
  INTO v_override_id, v_old_value
  FROM tenant_feature_overrides
  WHERE tenant_id = p_tenant_id AND feature_key = p_feature_key;

  IF v_override_id IS NULL THEN
    RETURN false;
  END IF;

  -- Deletar override
  DELETE FROM tenant_feature_overrides
  WHERE id = v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, old_value, changed_by
  ) VALUES (
    p_tenant_id, 'feature', v_override_id, 'deleted', v_old_value, v_actor_id
  );

  RETURN true;
END;
$$;

-- =====================================================
-- RPC: delete_limit_override
-- =====================================================
CREATE OR REPLACE FUNCTION delete_limit_override(
  p_tenant_id UUID,
  p_limit_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_override_id UUID;
  v_old_value JSONB;
BEGIN
  SELECT id INTO v_actor_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Buscar override existente
  SELECT id, json_build_object(
    'limit_key', limit_key,
    'custom_value', custom_value,
    'reason', reason,
    'expires_at', expires_at
  )::jsonb
  INTO v_override_id, v_old_value
  FROM tenant_limit_overrides
  WHERE tenant_id = p_tenant_id AND limit_key = p_limit_key;

  IF v_override_id IS NULL THEN
    RETURN false;
  END IF;

  -- Deletar override
  DELETE FROM tenant_limit_overrides
  WHERE id = v_override_id;

  -- Registrar auditoria
  INSERT INTO override_audit_log (
    tenant_id, override_type, override_id, action, old_value, changed_by
  ) VALUES (
    p_tenant_id, 'limit', v_override_id, 'deleted', v_old_value, v_actor_id
  );

  RETURN true;
END;
$$;

-- =====================================================
-- RPC: get_all_overrides (para painel admin)
-- =====================================================
CREATE OR REPLACE FUNCTION get_all_overrides(
  p_tenant_id UUID DEFAULT NULL,
  p_include_expired BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'features', COALESCE((
      SELECT json_agg(json_build_object(
        'id', fo.id,
        'tenant_id', fo.tenant_id,
        'tenant_name', t.name,
        'feature_key', fo.feature_key,
        'is_enabled', fo.is_enabled,
        'reason', fo.reason,
        'enabled_by', fo.enabled_by,
        'enabled_by_name', p.full_name,
        'expires_at', fo.expires_at,
        'created_at', fo.created_at,
        'is_expired', fo.expires_at IS NOT NULL AND fo.expires_at <= now()
      ) ORDER BY fo.created_at DESC)
      FROM tenant_feature_overrides fo
      LEFT JOIN tenants t ON t.id = fo.tenant_id
      LEFT JOIN profiles p ON p.id = fo.enabled_by
      WHERE (p_tenant_id IS NULL OR fo.tenant_id = p_tenant_id)
        AND (p_include_expired OR fo.expires_at IS NULL OR fo.expires_at > now())
    ), '[]'::json),
    'limits', COALESCE((
      SELECT json_agg(json_build_object(
        'id', lo.id,
        'tenant_id', lo.tenant_id,
        'tenant_name', t.name,
        'limit_key', lo.limit_key,
        'custom_value', lo.custom_value,
        'reason', lo.reason,
        'enabled_by', lo.enabled_by,
        'enabled_by_name', p.full_name,
        'expires_at', lo.expires_at,
        'created_at', lo.created_at,
        'is_expired', lo.expires_at IS NOT NULL AND lo.expires_at <= now()
      ) ORDER BY lo.created_at DESC)
      FROM tenant_limit_overrides lo
      LEFT JOIN tenants t ON t.id = lo.tenant_id
      LEFT JOIN profiles p ON p.id = lo.enabled_by
      WHERE (p_tenant_id IS NULL OR lo.tenant_id = p_tenant_id)
        AND (p_include_expired OR lo.expires_at IS NULL OR lo.expires_at > now())
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_override_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenant_feature_overrides_updated_at
  BEFORE UPDATE ON tenant_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION update_override_updated_at();

CREATE TRIGGER trigger_tenant_limit_overrides_updated_at
  BEFORE UPDATE ON tenant_limit_overrides
  FOR EACH ROW EXECUTE FUNCTION update_override_updated_at();

-- Comentários
COMMENT ON TABLE tenant_feature_overrides IS 'Overrides de funcionalidades por tenant - permite liberar features independente do plano';
COMMENT ON TABLE tenant_limit_overrides IS 'Overrides de limites por tenant - permite ajustar limites independente do plano';
COMMENT ON TABLE override_audit_log IS 'Log de auditoria de todas as alterações em overrides';
COMMENT ON FUNCTION get_tenant_overrides() IS 'Retorna overrides ativos para o tenant do usuário autenticado';
