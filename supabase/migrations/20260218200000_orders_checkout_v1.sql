-- ============================================================================
-- MILESTONE 1: Orders / Checkout (Comanda) — MVP
-- Modelo híbrido: orders.appointment_id ALWAYS required.
-- Walk-in → appointment criado automaticamente.
-- ============================================================================

-- ─── 1. ENUMS ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('draft','open','paid','cancelled','refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_item_kind AS ENUM ('service','product');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. TABLES ──────────────────────────────────────────────────────────────

-- 2a. payment_methods (lookup per tenant)
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        text NOT NULL,            -- cash | pix | card | transfer | other
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- 2b. orders
CREATE TABLE IF NOT EXISTS public.orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id    uuid NOT NULL REFERENCES public.appointments(id),
  client_id         uuid NULL REFERENCES public.clients(id),
  professional_id   uuid NULL REFERENCES public.profiles(id),
  status            public.order_status NOT NULL DEFAULT 'open',
  subtotal_amount   numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount   numeric(12,2) NOT NULL DEFAULT 0,
  total_amount      numeric(12,2) NOT NULL DEFAULT 0,
  notes             text NULL,
  created_by        uuid NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_unique_appointment UNIQUE (tenant_id, appointment_id),
  CONSTRAINT orders_discount_range CHECK (discount_amount >= 0),
  CONSTRAINT orders_total_non_negative CHECK (total_amount >= 0)
);

-- 2c. order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind            public.order_item_kind NOT NULL,
  service_id      uuid NULL REFERENCES public.services(id),
  product_id      uuid NULL REFERENCES public.products(id),
  professional_id uuid NULL REFERENCES public.profiles(id),
  quantity        integer NOT NULL DEFAULT 1,
  unit_price      numeric(12,2) NOT NULL,
  total_price     numeric(12,2) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oi_service_requires_service_id CHECK (kind <> 'service' OR service_id IS NOT NULL),
  CONSTRAINT oi_product_requires_product_id CHECK (kind <> 'product' OR product_id IS NOT NULL),
  CONSTRAINT oi_quantity_positive CHECK (quantity > 0),
  CONSTRAINT oi_unit_price_non_negative CHECK (unit_price >= 0)
);

-- 2d. payments
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id            uuid NOT NULL REFERENCES public.orders(id),
  payment_method_id   uuid NOT NULL REFERENCES public.payment_methods(id),
  amount              numeric(12,2) NOT NULL,
  status              public.payment_status NOT NULL DEFAULT 'pending',
  paid_at             timestamptz NULL,
  reference           text NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0)
);

-- ─── 3. INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON public.orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON public.orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_appointment ON public.orders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON public.order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners
ALTER TABLE public.payment_methods FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

-- READ policies: tenant isolation
CREATE POLICY "pm_tenant_read" ON public.payment_methods FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "orders_tenant_read" ON public.orders FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "order_items_tenant_read" ON public.order_items FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "payments_tenant_read" ON public.payments FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- WRITE policies: block direct writes, force via RPC (SECURITY DEFINER)
-- service_role can write (for RPCs)
CREATE POLICY "pm_service_write" ON public.payment_methods FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "orders_service_write" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "order_items_service_write" ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payments_service_write" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 5. SEED DEFAULT PAYMENT METHODS (per tenant via trigger) ───────────────

CREATE OR REPLACE FUNCTION public.seed_payment_methods_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_methods (tenant_id, code, name, sort_order) VALUES
    (NEW.id, 'cash',     'Dinheiro',       1),
    (NEW.id, 'pix',      'PIX',            2),
    (NEW.id, 'card',     'Cartão',         3),
    (NEW.id, 'transfer', 'Transferência',  4)
  ON CONFLICT (tenant_id, code) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_payment_methods ON public.tenants;
CREATE TRIGGER trg_seed_payment_methods
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_payment_methods_for_tenant();

-- Backfill existing tenants
INSERT INTO public.payment_methods (tenant_id, code, name, sort_order)
SELECT t.id, v.code, v.name, v.sort_order
FROM public.tenants t
CROSS JOIN (VALUES
  ('cash',     'Dinheiro',      1),
  ('pix',      'PIX',           2),
  ('card',     'Cartão',        3),
  ('transfer', 'Transferência', 4)
) AS v(code, name, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- ─── 6. ADD source COLUMN TO appointments (nullable, backward-compat) ───────

DO $$ BEGIN
  ALTER TABLE public.appointments ADD COLUMN source text NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 7. RPCs ────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────
-- 7a. create_walkin_order_v1
--     Creates walk-in appointment + order atomically
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_walkin_order_v1(
  p_client_id         uuid DEFAULT NULL,
  p_professional_id   uuid DEFAULT NULL,  -- profiles.id
  p_notes             text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_profile     public.profiles%rowtype;
  v_is_admin    boolean;
  v_prof_id     uuid;
  v_apt_id      uuid;
  v_order_id    uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  -- Determine professional
  IF v_is_admin THEN
    v_prof_id := COALESCE(p_professional_id, v_profile.id);
  ELSE
    v_prof_id := v_profile.id;
  END IF;

  -- Validate professional belongs to tenant
  IF v_prof_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_prof_id AND tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Create walk-in appointment (no conflict check needed — walk-in has no slot)
  INSERT INTO public.appointments (
    tenant_id, client_id, professional_id,
    scheduled_at, duration_minutes, status, price, notes, source
  ) VALUES (
    v_profile.tenant_id, p_client_id, v_prof_id,
    now(), 0, 'confirmed', 0, p_notes, 'walk_in'
  )
  RETURNING id INTO v_apt_id;

  -- Create order
  INSERT INTO public.orders (
    tenant_id, appointment_id, client_id, professional_id,
    status, created_by
  ) VALUES (
    v_profile.tenant_id, v_apt_id, p_client_id, v_prof_id,
    'open', v_user_id
  )
  RETURNING id INTO v_order_id;

  -- Audit
  PERFORM public.log_tenant_action(
    v_profile.tenant_id, v_user_id,
    'walkin_order_created', 'order', v_order_id::text,
    jsonb_build_object('appointment_id', v_apt_id, 'client_id', p_client_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'appointment_id', v_apt_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_walkin_order_v1(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_walkin_order_v1(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_walkin_order_v1(uuid, uuid, text) TO service_role;

-- ─────────────────────────────────────────────────
-- 7b. create_order_for_appointment_v1
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_order_for_appointment_v1(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_apt       public.appointments%rowtype;
  v_order_id  uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  SELECT * INTO v_apt
  FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  IF v_apt.status = 'cancelled' THEN
    RAISE EXCEPTION 'Agendamento cancelado não pode ter comanda' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Agendamento já concluído' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Uniqueness enforced by DB constraint, but give a friendly message
  IF EXISTS (
    SELECT 1 FROM public.orders WHERE tenant_id = v_profile.tenant_id AND appointment_id = p_appointment_id
  ) THEN
    RAISE EXCEPTION 'Este agendamento já possui uma comanda' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.orders (
    tenant_id, appointment_id, client_id, professional_id,
    status, created_by
  ) VALUES (
    v_profile.tenant_id, v_apt.id, v_apt.client_id, v_apt.professional_id,
    'open', v_user_id
  )
  RETURNING id INTO v_order_id;

  -- If appointment has a service, auto-add as first item
  IF v_apt.service_id IS NOT NULL THEN
    INSERT INTO public.order_items (
      tenant_id, order_id, kind, service_id, professional_id,
      quantity, unit_price, total_price
    ) VALUES (
      v_profile.tenant_id, v_order_id, 'service', v_apt.service_id, v_apt.professional_id,
      1, v_apt.price, v_apt.price
    );

    UPDATE public.orders
    SET subtotal_amount = v_apt.price,
        total_amount = v_apt.price,
        updated_at = now()
    WHERE id = v_order_id;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id, v_user_id,
    'order_created_from_appointment', 'order', v_order_id::text,
    jsonb_build_object('appointment_id', p_appointment_id)
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_for_appointment_v1(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.create_order_for_appointment_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_for_appointment_v1(uuid) TO service_role;

-- ─────────────────────────────────────────────────
-- 7c. add_order_item_v1
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_order_item_v1(
  p_order_id        uuid,
  p_kind            text,          -- 'service' | 'product'
  p_service_id      uuid DEFAULT NULL,
  p_product_id      uuid DEFAULT NULL,
  p_quantity        integer DEFAULT 1,
  p_unit_price      numeric DEFAULT NULL,
  p_professional_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_profile     public.profiles%rowtype;
  v_order       public.orders%rowtype;
  v_price       numeric;
  v_total       numeric;
  v_item_id     uuid;
  v_new_subtotal numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada' USING DETAIL = 'NOT_FOUND'; END IF;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda não permite alterações (status: %)', v_order.status USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_kind NOT IN ('service', 'product') THEN
    RAISE EXCEPTION 'Tipo de item inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Resolve price
  IF p_kind = 'service' THEN
    IF p_service_id IS NULL THEN
      RAISE EXCEPTION 'service_id obrigatório para item tipo serviço' USING DETAIL = 'VALIDATION_ERROR';
    END IF;
    IF p_unit_price IS NOT NULL THEN
      v_price := p_unit_price;
    ELSE
      SELECT price INTO v_price FROM public.services WHERE id = p_service_id AND tenant_id = v_profile.tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado' USING DETAIL = 'NOT_FOUND'; END IF;
    END IF;
  ELSE -- product
    IF p_product_id IS NULL THEN
      RAISE EXCEPTION 'product_id obrigatório para item tipo produto' USING DETAIL = 'VALIDATION_ERROR';
    END IF;
    IF p_unit_price IS NOT NULL THEN
      v_price := p_unit_price;
    ELSE
      SELECT sale_price INTO v_price FROM public.products WHERE id = p_product_id AND tenant_id = v_profile.tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado' USING DETAIL = 'NOT_FOUND'; END IF;
    END IF;
  END IF;

  v_total := v_price * p_quantity;

  INSERT INTO public.order_items (
    tenant_id, order_id, kind, service_id, product_id, professional_id,
    quantity, unit_price, total_price
  ) VALUES (
    v_profile.tenant_id, p_order_id, p_kind::public.order_item_kind,
    p_service_id, p_product_id, p_professional_id,
    p_quantity, v_price, v_total
  )
  RETURNING id INTO v_item_id;

  -- Recalculate subtotal
  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal
  FROM public.order_items WHERE order_id = p_order_id;

  UPDATE public.orders
  SET subtotal_amount = v_new_subtotal,
      total_amount = GREATEST(v_new_subtotal - discount_amount, 0),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'item_id', v_item_id, 'subtotal', v_new_subtotal);
END;
$$;

REVOKE ALL ON FUNCTION public.add_order_item_v1(uuid, text, uuid, uuid, integer, numeric, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.add_order_item_v1(uuid, text, uuid, uuid, integer, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_order_item_v1(uuid, text, uuid, uuid, integer, numeric, uuid) TO service_role;

-- ─────────────────────────────────────────────────
-- 7d. remove_order_item_v1
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_order_item_v1(
  p_order_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_profile      public.profiles%rowtype;
  v_item         public.order_items%rowtype;
  v_order        public.orders%rowtype;
  v_new_subtotal numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_item FROM public.order_items
  WHERE id = p_order_item_id AND tenant_id = v_profile.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado' USING DETAIL = 'NOT_FOUND'; END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = v_item.order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda não permite alterações' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  DELETE FROM public.order_items WHERE id = p_order_item_id;

  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal
  FROM public.order_items WHERE order_id = v_order.id;

  UPDATE public.orders
  SET subtotal_amount = v_new_subtotal,
      discount_amount = LEAST(discount_amount, v_new_subtotal),
      total_amount = GREATEST(v_new_subtotal - LEAST(discount_amount, v_new_subtotal), 0),
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object('success', true, 'subtotal', v_new_subtotal);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_order_item_v1(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_order_item_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_order_item_v1(uuid) TO service_role;

-- ─────────────────────────────────────────────────
-- 7e. set_order_discount_v1
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_order_discount_v1(
  p_order_id        uuid,
  p_discount_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_order    public.orders%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada' USING DETAIL = 'NOT_FOUND'; END IF;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda não permite alterações' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_discount_amount < 0 THEN
    RAISE EXCEPTION 'Desconto não pode ser negativo' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_discount_amount > v_order.subtotal_amount THEN
    RAISE EXCEPTION 'Desconto não pode ser maior que o subtotal' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  UPDATE public.orders
  SET discount_amount = p_discount_amount,
      total_amount = GREATEST(subtotal_amount - p_discount_amount, 0),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_amount', GREATEST(v_order.subtotal_amount - p_discount_amount, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_order_discount_v1(uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.set_order_discount_v1(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_discount_v1(uuid, numeric) TO service_role;

-- ─────────────────────────────────────────────────
-- 7f. finalize_order_v1  (THE ATOMIC CHECKOUT)
--     payments[] = array of {payment_method_id, amount}
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_order_v1(
  p_order_id  uuid,
  p_payments  jsonb  -- [{payment_method_id, amount}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_profile       public.profiles%rowtype;
  v_order         public.orders%rowtype;
  v_pay           jsonb;
  v_pay_total     numeric := 0;
  v_pm_id         uuid;
  v_pm_amount     numeric;
  v_item          record;
  v_product       public.products%rowtype;
  v_new_qty       integer;
  v_tx_date       date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  -- Lock order
  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada' USING DETAIL = 'NOT_FOUND'; END IF;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda já finalizada ou cancelada (status: %)', v_order.status USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_order.total_amount <= 0 THEN
    RAISE EXCEPTION 'Comanda sem valor para pagamento' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Validate payments array
  IF p_payments IS NULL OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Nenhum pagamento informado' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Calculate total of payments
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_pm_id := (v_pay->>'payment_method_id')::uuid;
    v_pm_amount := (v_pay->>'amount')::numeric;

    IF v_pm_id IS NULL OR v_pm_amount IS NULL OR v_pm_amount <= 0 THEN
      RAISE EXCEPTION 'Pagamento inválido' USING DETAIL = 'VALIDATION_ERROR';
    END IF;

    -- Validate payment method belongs to tenant
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_methods
      WHERE id = v_pm_id AND tenant_id = v_profile.tenant_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Método de pagamento inválido' USING DETAIL = 'VALIDATION_ERROR';
    END IF;

    v_pay_total := v_pay_total + v_pm_amount;
  END LOOP;

  -- Validate split = total (allow 0.01 tolerance for rounding)
  IF abs(v_pay_total - v_order.total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos pagamentos (%) difere do total da comanda (%)',
      v_pay_total, v_order.total_amount
    USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- ─── STOCK VALIDATION (pre-check all products before any mutation) ───
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.name AS product_name, p.quantity AS stock_qty
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.kind = 'product'
  LOOP
    IF v_item.stock_qty < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, necessário %',
        v_item.product_name, v_item.stock_qty, v_item.quantity
      USING DETAIL = 'STOCK_INSUFFICIENT';
    END IF;
  END LOOP;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  -- ─── CREATE PAYMENTS ───
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO public.payments (
      tenant_id, order_id, payment_method_id, amount, status, paid_at
    ) VALUES (
      v_profile.tenant_id, p_order_id,
      (v_pay->>'payment_method_id')::uuid,
      (v_pay->>'amount')::numeric,
      'paid', now()
    );
  END LOOP;

  -- ─── STOCK MOVEMENTS (out, sale) for product items ───
  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.kind = 'product'
  LOOP
    -- Lock product
    SELECT * INTO v_product FROM public.products
    WHERE id = v_item.product_id AND tenant_id = v_profile.tenant_id
    FOR UPDATE;

    v_new_qty := v_product.quantity - v_item.quantity;

    -- Double-check (race condition guard)
    IF v_new_qty < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%"', v_product.name USING DETAIL = 'STOCK_INSUFFICIENT';
    END IF;

    UPDATE public.products SET quantity = v_new_qty, updated_at = now()
    WHERE id = v_item.product_id;

    INSERT INTO public.stock_movements (
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) VALUES (
      v_profile.tenant_id, v_item.product_id,
      -v_item.quantity, 'out', 'sale',
      'Venda via comanda #' || left(p_order_id::text, 8),
      v_user_id::text
    );
  END LOOP;

  -- ─── FINANCIAL TRANSACTIONS (income) ───
  -- One transaction for services total
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND kind = 'service') THEN
    INSERT INTO public.financial_transactions (
      tenant_id, appointment_id, type, category, amount, description, transaction_date
    ) VALUES (
      v_profile.tenant_id, v_order.appointment_id,
      'income', 'Serviço',
      (SELECT COALESCE(SUM(total_price), 0) FROM public.order_items WHERE order_id = p_order_id AND kind = 'service'),
      'Comanda #' || left(p_order_id::text, 8) || ' — serviços',
      v_tx_date
    );
  END IF;

  -- One transaction for products total
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND kind = 'product') THEN
    INSERT INTO public.financial_transactions (
      tenant_id, appointment_id, type, category, amount, description, transaction_date
    ) VALUES (
      v_profile.tenant_id, v_order.appointment_id,
      'income', 'Venda de Produto',
      (SELECT COALESCE(SUM(total_price), 0) FROM public.order_items WHERE order_id = p_order_id AND kind = 'product'),
      'Comanda #' || left(p_order_id::text, 8) || ' — produtos',
      v_tx_date
    );
  END IF;

  -- Discount as expense if > 0
  IF v_order.discount_amount > 0 THEN
    INSERT INTO public.financial_transactions (
      tenant_id, appointment_id, type, category, amount, description, transaction_date
    ) VALUES (
      v_profile.tenant_id, v_order.appointment_id,
      'expense', 'Desconto',
      v_order.discount_amount,
      'Desconto comanda #' || left(p_order_id::text, 8),
      v_tx_date
    );
  END IF;

  -- ─── UPDATE ORDER STATUS ───
  UPDATE public.orders
  SET status = 'paid', updated_at = now()
  WHERE id = p_order_id;

  -- ─── UPDATE APPOINTMENT STATUS to completed ───
  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = v_order.appointment_id
    AND status <> 'completed';

  -- Audit
  PERFORM public.log_tenant_action(
    v_profile.tenant_id, v_user_id,
    'order_finalized', 'order', p_order_id::text,
    jsonb_build_object(
      'total', v_order.total_amount,
      'payments_count', jsonb_array_length(p_payments),
      'appointment_id', v_order.appointment_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'paid'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_order_v1(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_order_v1(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_v1(uuid, jsonb) TO service_role;

-- ─── 8. GRANTS (read-only for tables — writes via RPC) ─────────────────────

GRANT SELECT ON public.payment_methods TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

GRANT ALL ON public.payment_methods TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.payments TO service_role;
