-- GCP Migration: RLS Policies - crm_loyalty
-- Total: 12 policies


-- ── Table: consent_forms ──
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "consent_forms_select" ON public.consent_forms
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "consent_forms_insert" ON public.consent_forms
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "consent_forms_update" ON public.consent_forms
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "consent_forms_delete" ON public.consent_forms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: loyalty_tiers ──
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE POLICY "loyalty_tiers tenant isolation" ON loyalty_tiers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );


-- ── Table: points_ledger ──
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE POLICY "points_ledger tenant isolation" ON points_ledger
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );


-- ── Table: points_wallets ──
ALTER TABLE public.points_wallets ENABLE ROW LEVEL SECURITY;

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE POLICY "points_wallets tenant isolation" ON points_wallets
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );


-- ── Table: referrals ──
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "referrals_select" ON public.referrals
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "referrals_insert" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "referrals_update" ON public.referrals
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );


-- ── Table: voucher_redemptions ──
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE POLICY "voucher_redemptions tenant isolation" ON voucher_redemptions
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );


-- ── Table: vouchers ──
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE POLICY "vouchers tenant isolation" ON vouchers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

