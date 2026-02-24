-- ══════════════════════════════════════════════════════════════════════════════
-- Fase 26D — Configuração de Gamificação
-- ══════════════════════════════════════════════════════════════════════════════
-- Permite desativar pop-ups de gamificação (comissão, metas, lucro) por:
-- 1. Tenant (admin desativa globalmente para toda a clínica)
-- 2. Usuário (cada profissional pode desativar para si)
-- ══════════════════════════════════════════════════════════════════════════════

-- Adicionar coluna em tenants para controle global
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS gamification_enabled boolean DEFAULT true;

COMMENT ON COLUMN tenants.gamification_enabled IS 
  'Se false, desativa pop-ups de gamificação para toda a clínica';

-- Adicionar coluna em profiles para preferência individual
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS show_gamification_popups boolean DEFAULT true;

COMMENT ON COLUMN profiles.show_gamification_popups IS 
  'Se false, desativa pop-ups de gamificação para este usuário (respeitando também o tenant)';

-- Criar função para verificar se gamificação está habilitada para um usuário
CREATE OR REPLACE FUNCTION is_gamification_enabled_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_enabled boolean;
  v_user_enabled boolean;
BEGIN
  SELECT 
    t.gamification_enabled,
    p.show_gamification_popups
  INTO v_tenant_enabled, v_user_enabled
  FROM profiles p
  JOIN tenants t ON t.id = p.tenant_id
  WHERE p.user_id = p_user_id;
  
  -- Ambos precisam estar true para mostrar pop-ups
  RETURN COALESCE(v_tenant_enabled, true) AND COALESCE(v_user_enabled, true);
END;
$$;

COMMENT ON FUNCTION is_gamification_enabled_for_user IS 
  'Retorna true se pop-ups de gamificação devem ser exibidos para o usuário';

-- Atualizar get_my_context para incluir gamification settings
-- (Isso será feito no código, não precisa alterar a RPC aqui)
