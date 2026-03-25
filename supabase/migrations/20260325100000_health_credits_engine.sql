-- ============================================================================
-- MIGRAÇÃO: Motor Completo de Créditos de Saúde (Fidelização)
-- RPCs atômicas, triggers automáticos, recálculo de tier, expiração
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1) Adicionar coluna expires_at nas transações (para expiração)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.health_credits_transactions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_health_credits_tx_expires
  ON public.health_credits_transactions (expires_at)
  WHERE expires_at IS NOT NULL AND type = 'earn';

-- ═══════════════════════════════════════════════════════════════════
-- 2) Adicionar coluna credits_expiry_days na regra (default 365)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.health_credits_rules
  ADD COLUMN IF NOT EXISTS expiry_days integer NOT NULL DEFAULT 365;

ALTER TABLE public.health_credits_rules
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';

ALTER TABLE public.health_credits_rules
  ADD COLUMN IF NOT EXISTS max_per_day integer DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3) Criar tabela de configuração de resgate por tenant
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.health_credits_redemption_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  credits_per_real numeric NOT NULL DEFAULT 10,
  min_redeem integer NOT NULL DEFAULT 50,
  max_discount_percent numeric NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_credits_redemption_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professionals_manage_redemption_config" ON public.health_credits_redemption_config;
CREATE POLICY "professionals_manage_redemption_config"
  ON public.health_credits_redemption_config
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "patients_view_redemption_config" ON public.health_credits_redemption_config;
CREATE POLICY "patients_view_redemption_config"
  ON public.health_credits_redemption_config
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.patient_profiles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- 4) Função auxiliar: recalcula tier baseado em lifetime_earned
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hc_recalc_tier(p_lifetime_earned integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_lifetime_earned >= 1000 THEN 'platinum'
    WHEN p_lifetime_earned >= 500  THEN 'gold'
    WHEN p_lifetime_earned >= 200  THEN 'silver'
    ELSE 'bronze'
  END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5) RPC: award_health_credits — conceder créditos atomicamente
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.award_health_credits(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_type text DEFAULT 'manual',
  p_reference_id uuid DEFAULT NULL,
  p_expiry_days integer DEFAULT 365,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance integer;
  v_new_lifetime integer;
  v_new_tier text;
  v_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Quantidade de créditos deve ser positiva';
  END IF;

  -- Upsert no saldo
  INSERT INTO public.health_credits_balance (tenant_id, patient_id, balance, lifetime_earned, tier)
  VALUES (p_tenant_id, p_patient_id, p_amount, p_amount, public.hc_recalc_tier(p_amount))
  ON CONFLICT (tenant_id, patient_id)
  DO UPDATE SET
    balance = health_credits_balance.balance + p_amount,
    lifetime_earned = health_credits_balance.lifetime_earned + p_amount,
    tier = public.hc_recalc_tier(health_credits_balance.lifetime_earned + p_amount),
    updated_at = now()
  RETURNING balance, lifetime_earned, tier
  INTO v_new_balance, v_new_lifetime, v_new_tier;

  -- Registrar transação
  INSERT INTO public.health_credits_transactions (
    tenant_id, patient_id, type, amount, balance_after,
    reason, reference_type, reference_id, created_by, expires_at
  ) VALUES (
    p_tenant_id, p_patient_id, 'earn', p_amount, v_new_balance,
    p_reason, p_reference_type, p_reference_id,
    COALESCE(p_created_by, auth.uid()),
    CASE WHEN p_expiry_days > 0 THEN now() + (p_expiry_days || ' days')::interval ELSE NULL END
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'lifetime_earned', v_new_lifetime,
    'tier', v_new_tier,
    'awarded', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_health_credits(uuid,uuid,integer,text,text,uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_health_credits(uuid,uuid,integer,text,text,uuid,integer,uuid) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 6) RPC: redeem_health_credits — resgatar créditos atomicamente
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.redeem_health_credits(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'Resgate de créditos',
  p_reference_type text DEFAULT 'manual',
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Quantidade de créditos deve ser positiva';
  END IF;

  -- Lock e verificar saldo
  SELECT balance INTO v_current_balance
  FROM public.health_credits_balance
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Paciente não possui saldo de créditos';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, solicitado: %', v_current_balance, p_amount;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.health_credits_balance
  SET balance = v_new_balance,
      lifetime_redeemed = lifetime_redeemed + p_amount,
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id;

  INSERT INTO public.health_credits_transactions (
    tenant_id, patient_id, type, amount, balance_after,
    reason, reference_type, reference_id, created_by
  ) VALUES (
    p_tenant_id, p_patient_id, 'redeem', -p_amount, v_new_balance,
    p_reason, p_reference_type, p_reference_id, auth.uid()
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'redeemed', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_health_credits(uuid,uuid,integer,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_health_credits(uuid,uuid,integer,text,text,uuid) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 7) RPC: adjust_health_credits — ajuste manual (admin)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.adjust_health_credits(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance integer;
  v_tx_id uuid;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Ajuste não pode ser zero';
  END IF;

  -- Verificar se é admin do tenant
  IF NOT public.is_tenant_admin(auth.uid(), p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem fazer ajustes manuais';
  END IF;

  -- Upsert no saldo
  INSERT INTO public.health_credits_balance (tenant_id, patient_id, balance, tier)
  VALUES (p_tenant_id, p_patient_id, GREATEST(p_amount, 0), 'bronze')
  ON CONFLICT (tenant_id, patient_id)
  DO UPDATE SET
    balance = GREATEST(health_credits_balance.balance + p_amount, 0),
    lifetime_earned = CASE
      WHEN p_amount > 0 THEN health_credits_balance.lifetime_earned + p_amount
      ELSE health_credits_balance.lifetime_earned
    END,
    tier = CASE
      WHEN p_amount > 0 THEN public.hc_recalc_tier(health_credits_balance.lifetime_earned + p_amount)
      ELSE health_credits_balance.tier
    END,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.health_credits_transactions (
    tenant_id, patient_id, type, amount, balance_after,
    reason, reference_type, created_by
  ) VALUES (
    p_tenant_id, p_patient_id, 'adjustment', p_amount, v_new_balance,
    p_reason, 'manual', auth.uid()
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'adjusted', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_health_credits(uuid,uuid,integer,text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 8) Trigger: auto-conceder créditos ao completar consulta
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hc_on_appointment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_patient_id uuid;
  v_today_count integer;
BEGIN
  -- Só dispara quando status muda para 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Buscar patient_id do client
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE id = NEW.client_id
    AND tenant_id = NEW.tenant_id;

  IF v_patient_id IS NULL THEN
    -- client pode não ser patient (caso edge)
    RETURN NEW;
  END IF;

  -- Buscar regra ativa para appointment_completed
  FOR v_rule IN
    SELECT * FROM public.health_credits_rules
    WHERE tenant_id = NEW.tenant_id
      AND trigger_type = 'appointment_completed'
      AND is_active = true
  LOOP
    -- Verificar limite diário se configurado
    IF v_rule.max_per_day IS NOT NULL THEN
      SELECT COUNT(*) INTO v_today_count
      FROM public.health_credits_transactions
      WHERE tenant_id = NEW.tenant_id
        AND patient_id = v_patient_id
        AND reference_type = 'appointment'
        AND type = 'earn'
        AND created_at::date = CURRENT_DATE;

      IF v_today_count >= v_rule.max_per_day THEN
        CONTINUE;
      END IF;
    END IF;

    -- Conceder créditos
    PERFORM public.award_health_credits(
      NEW.tenant_id,
      v_patient_id,
      v_rule.points,
      'Consulta realizada — ' || COALESCE(
        (SELECT name FROM public.services WHERE id = NEW.service_id),
        'Atendimento'
      ),
      'appointment',
      NEW.id,
      v_rule.expiry_days,
      NULL -- system action
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hc_appointment_completed ON public.appointments;
CREATE TRIGGER trg_hc_appointment_completed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.hc_on_appointment_completed();

-- ═══════════════════════════════════════════════════════════════════
-- 9) Trigger: auto-conceder créditos ao avaliar atendimento
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hc_on_rating_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_appointment RECORD;
  v_patient_id uuid;
BEGIN
  -- Buscar dados do appointment
  SELECT a.tenant_id, a.client_id
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = NEW.appointment_id;

  IF v_appointment IS NULL THEN
    RETURN NEW;
  END IF;

  v_patient_id := v_appointment.client_id;

  FOR v_rule IN
    SELECT * FROM public.health_credits_rules
    WHERE tenant_id = v_appointment.tenant_id
      AND trigger_type = 'review'
      AND is_active = true
  LOOP
    -- Não premiar duplicado para mesmo appointment
    IF EXISTS (
      SELECT 1 FROM public.health_credits_transactions
      WHERE tenant_id = v_appointment.tenant_id
        AND patient_id = v_patient_id
        AND reference_type = 'review'
        AND reference_id = NEW.appointment_id
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public.award_health_credits(
      v_appointment.tenant_id,
      v_patient_id,
      v_rule.points,
      'Avaliação do atendimento',
      'review',
      NEW.appointment_id,
      v_rule.expiry_days,
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hc_rating_submitted ON public.appointment_ratings;
CREATE TRIGGER trg_hc_rating_submitted
  AFTER INSERT ON public.appointment_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.hc_on_rating_submitted();

-- ═══════════════════════════════════════════════════════════════════
-- 10) Função de expiração de créditos (cron-safe)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hc_expire_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec RECORD;
  v_expired_total integer := 0;
  v_remaining integer;
BEGIN
  -- Buscar transações earn expiradas que ainda têm créditos disponíveis
  FOR v_rec IN
    SELECT
      t.id,
      t.tenant_id,
      t.patient_id,
      t.amount AS original_amount,
      b.balance AS current_balance
    FROM public.health_credits_transactions t
    JOIN public.health_credits_balance b
      ON b.tenant_id = t.tenant_id AND b.patient_id = t.patient_id
    WHERE t.type = 'earn'
      AND t.expires_at IS NOT NULL
      AND t.expires_at < now()
      AND b.balance > 0
    ORDER BY t.expires_at ASC
    FOR UPDATE OF b
  LOOP
    -- Expirar no máximo o que o paciente tem de saldo
    v_remaining := LEAST(v_rec.original_amount, v_rec.current_balance);

    IF v_remaining <= 0 THEN
      -- Marcar como processado movendo expires_at para null
      UPDATE public.health_credits_transactions SET expires_at = NULL WHERE id = v_rec.id;
      CONTINUE;
    END IF;

    UPDATE public.health_credits_balance
    SET balance = GREATEST(balance - v_remaining, 0),
        updated_at = now()
    WHERE tenant_id = v_rec.tenant_id AND patient_id = v_rec.patient_id;

    INSERT INTO public.health_credits_transactions (
      tenant_id, patient_id, type, amount, balance_after,
      reason, reference_type, reference_id
    ) VALUES (
      v_rec.tenant_id,
      v_rec.patient_id,
      'expire',
      -v_remaining,
      GREATEST(v_rec.current_balance - v_remaining, 0),
      'Créditos expirados',
      'expiration',
      v_rec.id -- referência à transação original
    );

    -- Marcar transação original como processada
    UPDATE public.health_credits_transactions SET expires_at = NULL WHERE id = v_rec.id;

    v_expired_total := v_expired_total + v_remaining;
  END LOOP;

  RETURN v_expired_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hc_expire_credits() TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 11) RPC para listar saldos de pacientes (admin)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_health_credits_leaderboard(
  p_tenant_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  patient_id uuid,
  patient_name text,
  balance integer,
  lifetime_earned integer,
  lifetime_redeemed integer,
  tier text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    b.patient_id,
    COALESCE(c.name, 'Paciente') AS patient_name,
    b.balance,
    b.lifetime_earned,
    b.lifetime_redeemed,
    b.tier,
    b.updated_at
  FROM public.health_credits_balance b
  JOIN public.patients c ON c.id = b.patient_id
  WHERE b.tenant_id = p_tenant_id
    AND b.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ORDER BY b.lifetime_earned DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_health_credits_leaderboard(uuid, integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 12) RPC para buscar extrato do paciente (admin view)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_patient_credits_history(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  type text,
  amount integer,
  balance_after integer,
  reason text,
  reference_type text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id,
    t.type,
    t.amount,
    t.balance_after,
    t.reason,
    t.reference_type,
    t.created_at,
    t.expires_at
  FROM public.health_credits_transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.patient_id = p_patient_id
    AND p_tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ORDER BY t.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_credits_history(uuid, uuid, integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 13) Inserir regras padrão para tenants existentes (se não existirem)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO public.health_credits_rules (tenant_id, name, trigger_type, points, is_active, description, expiry_days, max_per_day)
SELECT
  t.id,
  'Consulta realizada',
  'appointment_completed',
  10,
  true,
  'Paciente recebe pontos ao completar uma consulta',
  365,
  3
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.health_credits_rules r
  WHERE r.tenant_id = t.id AND r.trigger_type = 'appointment_completed'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.health_credits_rules (tenant_id, name, trigger_type, points, is_active, description, expiry_days, max_per_day)
SELECT
  t.id,
  'Avaliou o atendimento',
  'review',
  5,
  true,
  'Paciente recebe pontos ao avaliar o atendimento',
  365,
  1
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.health_credits_rules r
  WHERE r.tenant_id = t.id AND r.trigger_type = 'review'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.health_credits_rules (tenant_id, name, trigger_type, points, is_active, description, expiry_days, max_per_day)
SELECT
  t.id,
  'Aniversário',
  'birthday',
  25,
  true,
  'Bônus anual de aniversário do paciente',
  365,
  NULL
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.health_credits_rules r
  WHERE r.tenant_id = t.id AND r.trigger_type = 'birthday'
)
ON CONFLICT DO NOTHING;

-- Configuração padrão de resgate
INSERT INTO public.health_credits_redemption_config (tenant_id, credits_per_real, min_redeem, max_discount_percent)
SELECT t.id, 10, 50, 20
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.health_credits_redemption_config r
  WHERE r.tenant_id = t.id
)
ON CONFLICT DO NOTHING;
