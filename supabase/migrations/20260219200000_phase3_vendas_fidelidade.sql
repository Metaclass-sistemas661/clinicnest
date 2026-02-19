-- ═══════════════════════════════════════════════════════════════
-- FASE 3 — Vendas & Fidelidade
-- Vouchers/Gift Cards · Programa de Pontos · Tiers · Cupons
-- ═══════════════════════════════════════════════════════════════

-- ─── Tenant config columns ───────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS points_enabled   boolean        DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_per_real  numeric(10,4)  DEFAULT 1;

-- ─── 3.1 Vouchers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  code         text        NOT NULL,
  type         text        NOT NULL CHECK (type IN ('valor_fixo','servico')),
  valor        numeric(10,2) NOT NULL DEFAULT 0,
  service_id   uuid        REFERENCES services(id) ON DELETE SET NULL,
  status       text        NOT NULL DEFAULT 'ativo'
                 CHECK (status IN ('ativo','resgatado','expirado')),
  expires_at   timestamptz,
  created_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  notes        text,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id   uuid        NOT NULL REFERENCES vouchers(id)  ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  order_id     uuid        REFERENCES orders(id)             ON DELETE SET NULL,
  redeemed_at  timestamptz DEFAULT now(),
  redeemed_by  uuid        REFERENCES profiles(id)           ON DELETE SET NULL
);

-- Track which voucher/coupon was applied to an order
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS applied_voucher_id  uuid REFERENCES vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_coupon_id   uuid; -- FK added after discount_coupons table

-- ─── 3.5 Cupons de Desconto ───────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_coupons (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code         text        NOT NULL,
  type         text        NOT NULL CHECK (type IN ('percent','fixed')),
  value        numeric(10,2) NOT NULL,
  max_uses     integer,
  used_count   integer     NOT NULL DEFAULT 0,
  valid_from   date,
  valid_until  date,
  service_id   uuid        REFERENCES services(id) ON DELETE SET NULL,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- Add FK for applied_coupon_id now that table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_applied_coupon_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_applied_coupon_id_fkey
        FOREIGN KEY (applied_coupon_id) REFERENCES discount_coupons(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ─── 3.2 Programa de Pontos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS points_wallets (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  balance      integer     NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (tenant_id, client_id)
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id    uuid        NOT NULL REFERENCES points_wallets(id) ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES clients(id)        ON DELETE CASCADE,
  delta        integer     NOT NULL,
  reason       text        NOT NULL CHECK (reason IN ('earn','redeem','adjust','expire')),
  ref_id       uuid,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- ─── 3.3 Tiers de Fidelidade ─────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  min_points       integer     NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  color            text        NOT NULL DEFAULT '#6b7280',
  icon             text        NOT NULL DEFAULT '🥉',
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE vouchers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_redemptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_coupons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_wallets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers        ENABLE ROW LEVEL SECURITY;

-- vouchers
CREATE POLICY "vouchers tenant isolation" ON vouchers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- voucher_redemptions
CREATE POLICY "voucher_redemptions tenant isolation" ON voucher_redemptions
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- discount_coupons
CREATE POLICY "discount_coupons tenant isolation" ON discount_coupons
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- points_wallets
CREATE POLICY "points_wallets tenant isolation" ON points_wallets
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- points_ledger
CREATE POLICY "points_ledger tenant isolation" ON points_ledger
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- loyalty_tiers
CREATE POLICY "loyalty_tiers tenant isolation" ON loyalty_tiers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant         ON vouchers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code           ON vouchers(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status         ON vouchers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_vid ON voucher_redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_tenant ON discount_coupons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_code   ON discount_coupons(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_points_wallets_tenant   ON points_wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_points_wallets_client   ON points_wallets(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_wallet    ON points_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_tenant    ON loyalty_tiers(tenant_id);

-- ─── RPC: redeem_voucher_v1 ───────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_voucher_v1(
  p_code     text,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_voucher   vouchers%ROWTYPE;
  v_order     orders%ROWTYPE;
BEGIN
  -- Resolve caller tenant
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE id = auth.uid();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','unauthenticated');
  END IF;

  -- Fetch order
  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','order_not_found');
  END IF;
  IF v_order.status NOT IN ('draft','open') THEN
    RETURN jsonb_build_object('success',false,'error','order_not_editable');
  END IF;
  IF v_order.applied_voucher_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',false,'error','voucher_already_applied');
  END IF;

  -- Fetch voucher
  SELECT * INTO v_voucher FROM vouchers
  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','voucher_not_found');
  END IF;
  IF v_voucher.status <> 'ativo' THEN
    RETURN jsonb_build_object('success',false,'error','voucher_inactive');
  END IF;
  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE vouchers SET status='expirado' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success',false,'error','voucher_expired');
  END IF;

  -- Apply: set discount and mark voucher
  UPDATE orders
  SET discount_amount    = LEAST(subtotal_amount, discount_amount + v_voucher.valor),
      total_amount       = GREATEST(0, total_amount - v_voucher.valor),
      applied_voucher_id = v_voucher.id
  WHERE id = p_order_id;

  -- Mark voucher redeemed
  UPDATE vouchers SET status='resgatado' WHERE id = v_voucher.id;

  -- Ledger entry
  INSERT INTO voucher_redemptions(voucher_id, tenant_id, order_id, redeemed_by)
  VALUES (v_voucher.id, v_tenant_id, p_order_id, auth.uid());

  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher.id,
    'discount_applied', v_voucher.valor
  );
END;
$$;

-- ─── RPC: validate_coupon_v1 ──────────────────────────────────
CREATE OR REPLACE FUNCTION validate_coupon_v1(
  p_code      text,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon discount_coupons%ROWTYPE;
BEGIN
  SELECT * INTO v_coupon FROM discount_coupons
  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid',false,'error','not_found');
  END IF;
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid',false,'error','inactive');
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > CURRENT_DATE THEN
    RETURN jsonb_build_object('valid',false,'error','not_yet_valid');
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < CURRENT_DATE THEN
    RETURN jsonb_build_object('valid',false,'error','expired');
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid',false,'error','max_uses_reached');
  END IF;

  RETURN jsonb_build_object(
    'valid',        true,
    'coupon_id',    v_coupon.id,
    'type',         v_coupon.type,
    'value',        v_coupon.value,
    'service_id',   v_coupon.service_id
  );
END;
$$;

-- ─── RPC: apply_coupon_to_order_v1 ───────────────────────────
CREATE OR REPLACE FUNCTION apply_coupon_to_order_v1(
  p_code     text,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_coupon    discount_coupons%ROWTYPE;
  v_order     orders%ROWTYPE;
  v_discount  numeric;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE id = auth.uid();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','unauthenticated');
  END IF;

  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','order_not_found');
  END IF;
  IF v_order.status NOT IN ('draft','open') THEN
    RETURN jsonb_build_object('success',false,'error','order_not_editable');
  END IF;
  IF v_order.applied_coupon_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',false,'error','coupon_already_applied');
  END IF;

  -- Validate coupon
  SELECT * INTO v_coupon FROM discount_coupons
  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','not_found');
  END IF;
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('success',false,'error','inactive');
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > CURRENT_DATE THEN
    RETURN jsonb_build_object('success',false,'error','not_yet_valid');
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < CURRENT_DATE THEN
    RETURN jsonb_build_object('success',false,'error','expired');
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('success',false,'error','max_uses_reached');
  END IF;

  -- Calculate discount
  IF v_coupon.type = 'percent' THEN
    v_discount := ROUND(v_order.subtotal_amount * v_coupon.value / 100, 2);
  ELSE
    v_discount := v_coupon.value;
  END IF;
  v_discount := LEAST(v_order.subtotal_amount, v_discount);

  -- Apply discount + increment used_count
  UPDATE orders
  SET discount_amount  = LEAST(subtotal_amount, discount_amount + v_discount),
      total_amount     = GREATEST(0, total_amount - v_discount),
      applied_coupon_id = v_coupon.id
  WHERE id = p_order_id;

  UPDATE discount_coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;

  RETURN jsonb_build_object(
    'success',          true,
    'coupon_id',        v_coupon.id,
    'discount_applied', v_discount
  );
END;
$$;

-- ─── RPC: earn_points_for_order_v1 ───────────────────────────
CREATE OR REPLACE FUNCTION earn_points_for_order_v1(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_order       orders%ROWTYPE;
  v_ppr         numeric;
  v_enabled     boolean;
  v_pts         integer;
  v_wallet_id   uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE id = auth.uid();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','unauthenticated');
  END IF;

  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','order_not_found');
  END IF;
  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('success',false,'error','order_not_paid');
  END IF;
  IF v_order.client_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'skipped','no_client');
  END IF;

  SELECT points_enabled, points_per_real INTO v_enabled, v_ppr
  FROM tenants WHERE id = v_tenant_id;
  IF NOT v_enabled OR v_ppr IS NULL OR v_ppr <= 0 THEN
    RETURN jsonb_build_object('success',false,'skipped','points_disabled');
  END IF;

  v_pts := FLOOR(v_order.total_amount * v_ppr)::integer;
  IF v_pts <= 0 THEN
    RETURN jsonb_build_object('success',true,'points_earned',0);
  END IF;

  -- Upsert wallet
  INSERT INTO points_wallets(tenant_id, client_id, balance)
  VALUES (v_tenant_id, v_order.client_id, 0)
  ON CONFLICT (tenant_id, client_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM points_wallets
  WHERE tenant_id = v_tenant_id AND client_id = v_order.client_id;

  -- Idempotency: check if already earned for this order
  IF EXISTS (
    SELECT 1 FROM points_ledger
    WHERE wallet_id = v_wallet_id AND reason = 'earn' AND ref_id = p_order_id
  ) THEN
    RETURN jsonb_build_object('success',true,'skipped','already_earned');
  END IF;

  UPDATE points_wallets
  SET balance = balance + v_pts, updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO points_ledger(wallet_id, tenant_id, client_id, delta, reason, ref_id)
  VALUES (v_wallet_id, v_tenant_id, v_order.client_id, v_pts, 'earn', p_order_id);

  RETURN jsonb_build_object('success',true,'points_earned',v_pts);
END;
$$;

-- ─── Default tiers seeder function ───────────────────────────
CREATE OR REPLACE FUNCTION seed_default_loyalty_tiers_v1(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO loyalty_tiers(tenant_id, name, min_points, discount_percent, color, icon, sort_order)
  VALUES
    (p_tenant_id, 'Bronze', 0,    0,    '#cd7f32', '🥉', 0),
    (p_tenant_id, 'Prata',  500,  5,    '#9ca3af', '🥈', 1),
    (p_tenant_id, 'Ouro',   2000, 10,   '#d97706', '🥇', 2)
  ON CONFLICT DO NOTHING;
END;
$$;
