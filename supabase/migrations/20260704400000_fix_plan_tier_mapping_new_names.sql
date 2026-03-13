-- ============================================================================
-- Migration: Atualizar mapeamento de planos — reconhecer tiers novos
-- ============================================================================
-- Problema: tenant_plan_tier() só reconhecia 'basic', 'pro', 'premium', mas os
-- planos reais gravados pelo checkout Asaas são 'starter', 'solo', 'clinic',
-- 'clinica'. Isso fazia limites de pacientes e features ficarem no nível 'basic'.
--
-- Fix: Adicionar mapeamento para os nomes novos + manter retro-compat com legado.
-- Também atualizar tenant_within_client_limit para:
--   - Liberar sem limite durante trial
--   - Mapear tiers novos aos limites corretos
-- ============================================================================

-- ─── 1. tenant_plan_tier — reconhecer nomes novos ──────────────────────────
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

-- ─── 2. tenant_has_feature — usar nomes novos ──────────────────────────────
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

-- ─── 3. tenant_within_client_limit — trial ilimitado + nomes novos ──────────
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
