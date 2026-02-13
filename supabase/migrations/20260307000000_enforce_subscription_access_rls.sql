-- Enforce subscription/trial access at DB level (RLS)

-- 1) Helper function: tenant_has_access
CREATE OR REPLACE FUNCTION public.tenant_has_access(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.tenant_id = p_tenant_id
      AND (
        lower(s.status) = 'active'
        OR (lower(s.status) = 'trialing' AND now() <= s.trial_end)
      )
    LIMIT 1
  );
$$;

-- 2) Core tables: block writes when tenant has no access

-- clients
DROP POLICY IF EXISTS "Users can create clients in their tenant" ON public.clients;
CREATE POLICY "Users can create clients in their tenant"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Users can update clients in their tenant" ON public.clients;
CREATE POLICY "Users can update clients in their tenant"
ON public.clients FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete clients in their tenant" ON public.clients;
CREATE POLICY "Admins can delete clients in their tenant"
ON public.clients FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- services
DROP POLICY IF EXISTS "Users can create services in their tenant" ON public.services;
CREATE POLICY "Users can create services in their tenant"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Users can update services in their tenant" ON public.services;
CREATE POLICY "Users can update services in their tenant"
ON public.services FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete services in their tenant" ON public.services;
CREATE POLICY "Admins can delete services in their tenant"
ON public.services FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- products
DROP POLICY IF EXISTS "Admins can create products in their tenant" ON public.products;
CREATE POLICY "Admins can create products in their tenant"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can update products in their tenant" ON public.products;
CREATE POLICY "Admins can update products in their tenant"
ON public.products FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete products in their tenant" ON public.products;
CREATE POLICY "Admins can delete products in their tenant"
ON public.products FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- appointments
DROP POLICY IF EXISTS "Users can create appointments in their tenant" ON public.appointments;
CREATE POLICY "Users can create appointments in their tenant"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Users can update appointments in their tenant" ON public.appointments;
CREATE POLICY "Users can update appointments in their tenant"
ON public.appointments FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete appointments in their tenant" ON public.appointments;
CREATE POLICY "Admins can delete appointments in their tenant"
ON public.appointments FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- financial_transactions (admin-only)
DROP POLICY IF EXISTS "Admins can create financials in their tenant" ON public.financial_transactions;
CREATE POLICY "Admins can create financials in their tenant"
ON public.financial_transactions FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can update financials in their tenant" ON public.financial_transactions;
CREATE POLICY "Admins can update financials in their tenant"
ON public.financial_transactions FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete financials in their tenant" ON public.financial_transactions;
CREATE POLICY "Admins can delete financials in their tenant"
ON public.financial_transactions FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- stock_movements
DROP POLICY IF EXISTS "Users can create stock movements in their tenant" ON public.stock_movements;
CREATE POLICY "Users can create stock movements in their tenant"
ON public.stock_movements FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
);

-- 3) Commissions/salary configuration tables

-- professional_commissions
DROP POLICY IF EXISTS "Admins can create commissions in their tenant" ON public.professional_commissions;
CREATE POLICY "Admins can create commissions in their tenant"
ON public.professional_commissions FOR INSERT
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can update commissions in their tenant" ON public.professional_commissions;
CREATE POLICY "Admins can update commissions in their tenant"
ON public.professional_commissions FOR UPDATE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete commissions in their tenant" ON public.professional_commissions;
CREATE POLICY "Admins can delete commissions in their tenant"
ON public.professional_commissions FOR DELETE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- commission_payments
-- Note: inserts can be performed by staff (their own) via RPC/trigger; still block when tenant has no access.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Staff can view own commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Admins can create commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Admins can update commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Admins can delete commissions" ON public.commission_payments;
  DROP POLICY IF EXISTS "Profissionais podem ver suas próprias comissões" ON public.commission_payments;
  DROP POLICY IF EXISTS "Sistema e admins podem criar pagamentos de comissão" ON public.commission_payments;
  DROP POLICY IF EXISTS "Apenas admins podem atualizar pagamentos" ON public.commission_payments;
  DROP POLICY IF EXISTS "Apenas admins podem deletar pagamentos" ON public.commission_payments;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "Admins can create commissions" ON public.commission_payments;
CREATE POLICY "Admins can create commissions"
ON public.commission_payments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tenant_id = commission_payments.tenant_id
  )
  AND (
    professional_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  )
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can update commissions" ON public.commission_payments;
CREATE POLICY "Admins can update commissions"
ON public.commission_payments FOR UPDATE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete commissions" ON public.commission_payments;
CREATE POLICY "Admins can delete commissions"
ON public.commission_payments FOR DELETE
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- appointment_completion_summaries
-- The RPC inserts here for realtime popup. Keep insert allowed only for tenants with access.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Sistema pode inserir completion summaries" ON public.appointment_completion_summaries;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "Sistema pode inserir completion summaries"
  ON public.appointment_completion_summaries FOR INSERT
  WITH CHECK (public.tenant_has_access(tenant_id));

-- salary_payments
DROP POLICY IF EXISTS "Admins can create salary payments" ON public.salary_payments;
CREATE POLICY "Admins can create salary payments"
ON public.salary_payments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
  )
  AND public.tenant_has_access(salary_payments.tenant_id)
);

DROP POLICY IF EXISTS "Admins can update salary payments" ON public.salary_payments;
CREATE POLICY "Admins can update salary payments"
ON public.salary_payments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
  )
  AND public.tenant_has_access(salary_payments.tenant_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
  )
  AND public.tenant_has_access(salary_payments.tenant_id)
);

DROP POLICY IF EXISTS "Admins can delete salary payments" ON public.salary_payments;
CREATE POLICY "Admins can delete salary payments"
ON public.salary_payments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = salary_payments.tenant_id
      AND ur.role = 'admin'
  )
  AND public.tenant_has_access(salary_payments.tenant_id)
);
