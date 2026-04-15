-- ============================================================
-- GCP Cloud SQL Migration - 005_policies_compliance.sql
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

-- GCP Migration: RLS Policies - compliance
-- Total: 23 policies


-- ── Table: adverse_events_attachments ──
ALTER TABLE public.adverse_events_attachments ENABLE ROW LEVEL SECURITY;

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE POLICY "adverse_events_attachments_tenant_isolation" ON adverse_events_attachments
  FOR ALL USING (
    adverse_event_id IN (
      SELECT id FROM adverse_events 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1)
    )
  );


-- ── Table: adverse_events_history ──
ALTER TABLE public.adverse_events_history ENABLE ROW LEVEL SECURITY;

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE POLICY "adverse_events_history_tenant_isolation" ON adverse_events_history
  FOR ALL USING (
    adverse_event_id IN (
      SELECT id FROM adverse_events 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1)
    )
  );


-- ── Table: backup_logs ──
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE POLICY "Tenant isolation for backup_logs" ON backup_logs
  FOR ALL USING (tenant_id IS NULL OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE POLICY "backup_logs_tenant_isolation" ON backup_logs
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: backup_retention_policies ──
ALTER TABLE public.backup_retention_policies ENABLE ROW LEVEL SECURITY;

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE POLICY "backup_retention_tenant_isolation" ON backup_retention_policies
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: backup_verifications ──
ALTER TABLE public.backup_verifications ENABLE ROW LEVEL SECURITY;

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE POLICY "backup_verifications_tenant_isolation" ON backup_verifications
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: dpo_config ──
ALTER TABLE public.dpo_config ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE POLICY "dpo_config_tenant_isolation" ON dpo_config
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: lgpd_consentimentos ──
ALTER TABLE public.lgpd_consentimentos ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE POLICY "lgpd_consentimentos_tenant_isolation" ON lgpd_consentimentos
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: lgpd_incidentes ──
ALTER TABLE public.lgpd_incidentes ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE POLICY "lgpd_incidentes_tenant_isolation" ON lgpd_incidentes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: lgpd_solicitacoes ──
ALTER TABLE public.lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE POLICY "lgpd_solicitacoes_tenant_isolation" ON lgpd_solicitacoes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: ona_indicators ──
ALTER TABLE public.ona_indicators ENABLE ROW LEVEL SECURITY;

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE POLICY "ona_indicators_tenant_isolation" ON ona_indicators
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1));


-- ── Table: override_audit_log ──
ALTER TABLE public.override_audit_log ENABLE ROW LEVEL SECURITY;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE POLICY "override_audit_log_select" ON override_audit_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid)
  );


-- ── Table: ripd_reports ──
ALTER TABLE public.ripd_reports ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE POLICY "Tenant isolation for ripd_reports" ON ripd_reports
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: sbis_documentation ──
ALTER TABLE public.sbis_documentation ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE POLICY "Tenant isolation for sbis_documentation" ON sbis_documentation
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: sngpc_agendamentos ──
ALTER TABLE public.sngpc_agendamentos ENABLE ROW LEVEL SECURITY;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE POLICY "Tenant isolation for sngpc_agendamentos" ON sngpc_agendamentos
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: sngpc_credenciais ──
ALTER TABLE public.sngpc_credenciais ENABLE ROW LEVEL SECURITY;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE POLICY "Tenant isolation for sngpc_credenciais" ON sngpc_credenciais
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: sngpc_estoque ──
ALTER TABLE public.sngpc_estoque ENABLE ROW LEVEL SECURITY;

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE POLICY "sngpc_estoque_tenant_isolation" ON sngpc_estoque
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1));


-- ── Table: sngpc_movimentacoes ──
ALTER TABLE public.sngpc_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE POLICY "sngpc_movimentacoes_tenant_isolation" ON sngpc_movimentacoes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1));


-- ── Table: sngpc_notificacoes_receita ──
ALTER TABLE public.sngpc_notificacoes_receita ENABLE ROW LEVEL SECURITY;

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE POLICY "sngpc_notificacoes_tenant_isolation" ON sngpc_notificacoes_receita
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1));


-- ── Table: sngpc_sequencial ──
ALTER TABLE public.sngpc_sequencial ENABLE ROW LEVEL SECURITY;

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE POLICY "sngpc_sequencial_tenant_isolation" ON sngpc_sequencial
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1));


-- ── Table: sngpc_tracked_prescriptions ──
ALTER TABLE public.sngpc_tracked_prescriptions ENABLE ROW LEVEL SECURITY;

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE POLICY "sngpc_tenant_isolation" ON public.sngpc_tracked_prescriptions
  FOR ALL USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = current_setting('app.current_user_id')::uuid
    )
  );


-- ── Table: sngpc_transmissoes ──
ALTER TABLE public.sngpc_transmissoes ENABLE ROW LEVEL SECURITY;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE POLICY "Tenant isolation for sngpc_transmissoes" ON sngpc_transmissoes
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: sngpc_transmissoes_log ──
ALTER TABLE public.sngpc_transmissoes_log ENABLE ROW LEVEL SECURITY;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE POLICY "Tenant isolation for sngpc_transmissoes_log" ON sngpc_transmissoes_log
  FOR ALL USING (
    transmissao_id IN (
      SELECT id FROM sngpc_transmissoes 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid)
    )
  );

