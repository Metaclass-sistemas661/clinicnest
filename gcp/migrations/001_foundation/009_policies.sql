-- ============================================================
-- GCP Cloud SQL Migration - 005_policies_foundation.sql
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

-- GCP Migration: RLS Policies - foundation
-- Total: 23 policies


-- ── Table: report_definitions ──
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Templates são públicos" ON report_definitions
  FOR SELECT USING (is_template = true OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Tenant pode criar relatórios" ON report_definitions
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Tenant pode atualizar seus relatórios" ON report_definitions
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid) AND is_template = false);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Tenant pode deletar seus relatórios" ON report_definitions
  FOR DELETE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid) AND is_template = false);


-- ── Table: report_executions ──
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Tenant isolation for report_executions" ON report_executions
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: report_schedules ──
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Tenant isolation for report_schedules" ON report_schedules
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: rpc_rate_limits ──
ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE POLICY "rpc_rate_limits_service_only" ON public.rpc_rate_limits
  FOR ALL TO service_role USING (true);


-- ── Table: storage ──
ALTER TABLE public.storage ENABLE ROW LEVEL SECURITY;

-- Source: 20260325000000_dental_images_v1.sql
CREATE POLICY "dental_images_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'dental-images' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = current_setting('app.current_user_id')::uuid
    )
  );

-- Source: 20260325000000_dental_images_v1.sql
CREATE POLICY "dental_images_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'dental-images' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = current_setting('app.current_user_id')::uuid
    )
  );

-- Source: 20260325000000_dental_images_v1.sql
CREATE POLICY "dental_images_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'dental-images' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = current_setting('app.current_user_id')::uuid
    )
  );

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "exam_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exam-files');

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "exam_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-files');

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "exam_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'exam-files');

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "exam_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exam-files');


-- ── Table: tenant_feature_overrides ──
ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE POLICY "tenant_feature_overrides_select" ON tenant_feature_overrides
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid)
  );


-- ── Table: tenant_limit_overrides ──
ALTER TABLE public.tenant_limit_overrides ENABLE ROW LEVEL SECURITY;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE POLICY "tenant_limit_overrides_select" ON tenant_limit_overrides
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid)
  );


-- ── Table: tenant_sequences ──
ALTER TABLE public.tenant_sequences ENABLE ROW LEVEL SECURITY;

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE POLICY "tenant_sequences_select" ON public.tenant_sequences
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE POLICY "tenant_sequences_update" ON public.tenant_sequences
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));


-- ── Table: tenants ──
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
CREATE POLICY "Patients can view their linked tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id IN (SELECT pp.tenant_id FROM public.patient_profiles pp WHERE pp.user_id=current_setting('app.current_user_id')::uuid AND pp.is_active=true));


-- ── Table: user_saved_reports ──
ALTER TABLE public.user_saved_reports ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Usuário vê seus relatórios salvos" ON user_saved_reports
  FOR SELECT USING (user_id = current_setting('app.current_user_id')::uuid);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Usuário pode criar relatórios salvos" ON user_saved_reports
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::uuid AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Usuário pode atualizar seus relatórios salvos" ON user_saved_reports
  FOR UPDATE USING (user_id = current_setting('app.current_user_id')::uuid);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE POLICY "Usuário pode deletar seus relatórios salvos" ON user_saved_reports
  FOR DELETE USING (user_id = current_setting('app.current_user_id')::uuid);

