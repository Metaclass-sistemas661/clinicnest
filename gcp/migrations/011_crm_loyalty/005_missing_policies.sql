-- Missing RLS Policies for 011_crm_loyalty
-- 5 policies for tables added in missing_tables phase

-- Table: health_credits_balance
CREATE POLICY "patients_view_own_balance"
  ON public.health_credits_balance
  FOR SELECT
  USING (
    patient_id IN (
      SELECT client_id FROM public.patient_profiles
      WHERE user_id = current_setting('app.current_user_id')::uuid AND is_active = true
    )
  );

-- Table: health_credits_balance
CREATE POLICY "professionals_manage_credits_balance"
  ON public.health_credits_balance
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = current_setting('app.current_user_id')::uuid)
  );

-- Table: health_credits_rules
CREATE POLICY "professionals_manage_credits_rules"
  ON public.health_credits_rules
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = current_setting('app.current_user_id')::uuid)
  );

-- Table: health_credits_transactions
CREATE POLICY "patients_view_own_transactions"
  ON public.health_credits_transactions
  FOR SELECT
  USING (
    patient_id IN (
      SELECT client_id FROM public.patient_profiles
      WHERE user_id = current_setting('app.current_user_id')::uuid AND is_active = true
    )
  );

-- Table: health_credits_transactions
CREATE POLICY "professionals_manage_credits_transactions"
  ON public.health_credits_transactions
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = current_setting('app.current_user_id')::uuid)
  );

