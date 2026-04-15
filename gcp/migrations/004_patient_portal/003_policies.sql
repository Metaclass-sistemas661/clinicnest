-- ============================================================
-- GCP Cloud SQL Migration - 005_policies_patient_portal.sql
-- Execution Order: 015
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: RLS Policies - patient_portal
-- Total: 24 policies


-- ── Table: patient_achievements ──
ALTER TABLE public.patient_achievements ENABLE ROW LEVEL SECURITY;

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE POLICY "patient_achievements_own" ON public.patient_achievements
  FOR SELECT TO authenticated
  USING (patient_user_id = current_setting('app.current_user_id')::uuid);


-- ── Table: patient_dependents ──
ALTER TABLE public.patient_dependents ENABLE ROW LEVEL SECURITY;

-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
CREATE POLICY "patient_dependents_patient_select" ON public.patient_dependents
  FOR SELECT TO authenticated
  USING (parent_patient_id IN (SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id=current_setting('app.current_user_id')::uuid AND pp.is_active=true));

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE POLICY "patient_dependents_tenant_all" ON public.patient_dependents
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid));


-- ── Table: patient_invoices ──
ALTER TABLE public.patient_invoices ENABLE ROW LEVEL SECURITY;

-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
CREATE POLICY "patient_invoices_patient_select" ON public.patient_invoices
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE POLICY "patient_invoices_tenant_all" ON public.patient_invoices
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid));


-- ── Table: patient_messages ──
ALTER TABLE public.patient_messages ENABLE ROW LEVEL SECURITY;

-- Source: 20260326600000_patient_portal_fix_queries_v2.sql
CREATE POLICY "patient_messages_patient_select" ON public.patient_messages
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Source: 20260326600000_patient_portal_fix_queries_v2.sql
CREATE POLICY "patient_messages_patient_insert" ON public.patient_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'patient' AND
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Source: 20260326200001_fix_patient_messages_patient_id.sql
CREATE POLICY "patient_messages_tenant_all" ON public.patient_messages
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid));


-- ── Table: patient_notifications ──
ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE POLICY patient_notifications_select ON public.patient_notifications
  FOR SELECT TO authenticated
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE POLICY patient_notifications_update ON public.patient_notifications
  FOR UPDATE TO authenticated
  USING (user_id = current_setting('app.current_user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE POLICY patient_notifications_insert_staff ON public.patient_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ── Table: patient_onboarding ──
ALTER TABLE public.patient_onboarding ENABLE ROW LEVEL SECURITY;

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE POLICY "patient_onboarding_own" ON public.patient_onboarding
  FOR ALL TO authenticated
  USING (patient_user_id = current_setting('app.current_user_id')::uuid)
  WITH CHECK (patient_user_id = current_setting('app.current_user_id')::uuid);


-- ── Table: patient_payments ──
ALTER TABLE public.patient_payments ENABLE ROW LEVEL SECURITY;

-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
CREATE POLICY "patient_payments_patient_select" ON public.patient_payments
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT pi.id FROM public.patient_invoices pi
      WHERE pi.client_id IN (
        SELECT pp.client_id FROM public.patient_profiles pp 
        WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
      )
    )
  );

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE POLICY "patient_payments_tenant_all" ON public.patient_payments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid));


-- ── Table: patient_profiles ──
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- Source: 20260320000000_patient_portal_v1.sql
CREATE POLICY patient_profiles_select_own ON public.patient_profiles
  FOR SELECT USING (user_id = current_setting('app.current_user_id')::uuid);

-- Source: 20260320000000_patient_portal_v1.sql
CREATE POLICY patient_profiles_manage_staff ON public.patient_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.tenant_id = p.tenant_id
      WHERE p.user_id = current_setting('app.current_user_id')::uuid
        AND p.tenant_id = patient_profiles.tenant_id
    )
  );


-- ── Table: patient_proms ──
ALTER TABLE public.patient_proms ENABLE ROW LEVEL SECURITY;

-- Source: 20260316200000_patient_proms.sql
CREATE POLICY "Profissionais leem PROMs do tenant" ON public.patient_proms
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid)
  );

-- Source: 20260316200000_patient_proms.sql
CREATE POLICY "Pacientes inserem PROMs" ON public.patient_proms
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
    AND tenant_id IN (
      SELECT pp.tenant_id FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Source: 20260316200000_patient_proms.sql
CREATE POLICY "Pacientes leem seus PROMs" ON public.patient_proms
  FOR SELECT USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );


-- ── Table: patient_vaccinations ──
ALTER TABLE public.patient_vaccinations ENABLE ROW LEVEL SECURITY;

-- Source: 20260326600000_patient_portal_fix_queries_v2.sql
CREATE POLICY "patient_vaccinations_patient_select" ON public.patient_vaccinations
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Source: 20260326300000_patient_portal_health_v1.sql
CREATE POLICY "patient_vaccinations_tenant_all" ON public.patient_vaccinations
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid));


-- ── Table: prescription_refill_requests ──
ALTER TABLE public.prescription_refill_requests ENABLE ROW LEVEL SECURITY;

-- Source: 20260316300000_prescription_refill_requests.sql
CREATE POLICY "Profissionais gerenciam refills do tenant" ON public.prescription_refill_requests
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid)
  );

-- Source: 20260316300000_prescription_refill_requests.sql
CREATE POLICY "Pacientes inserem refills" ON public.prescription_refill_requests
  FOR INSERT WITH CHECK (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Source: 20260316300000_prescription_refill_requests.sql
CREATE POLICY "Pacientes leem seus refills" ON public.prescription_refill_requests
  FOR SELECT USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

