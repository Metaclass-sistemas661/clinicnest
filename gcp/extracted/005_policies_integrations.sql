-- GCP Migration: RLS Policies - integrations
-- Total: 8 policies


-- ── Table: document_verifications ──
ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;

-- Source: 20260330900000_document_verification_v1.sql
CREATE POLICY "Anyone can log verification" ON public.document_verifications
  FOR INSERT
  WITH CHECK (true);

-- Source: 20260330900000_document_verification_v1.sql
CREATE POLICY "Tenant can view own verifications" ON public.document_verifications
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );


-- ── Table: incoming_rnds_bundles ──
ALTER TABLE public.incoming_rnds_bundles ENABLE ROW LEVEL SECURITY;

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE POLICY "rnds_incoming_tenant_isolation" ON public.incoming_rnds_bundles
  FOR ALL USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );


-- ── Table: rnds_certificates ──
ALTER TABLE public.rnds_certificates ENABLE ROW LEVEL SECURITY;

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE POLICY rnds_certificates_tenant_isolation ON rnds_certificates
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));


-- ── Table: rnds_submissions ──
ALTER TABLE public.rnds_submissions ENABLE ROW LEVEL SECURITY;

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE POLICY rnds_submissions_tenant_isolation ON rnds_submissions
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));


-- ── Table: rnds_tokens ──
ALTER TABLE public.rnds_tokens ENABLE ROW LEVEL SECURITY;

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE POLICY rnds_tokens_tenant_isolation ON rnds_tokens
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));


-- ── Table: tsa_config ──
ALTER TABLE public.tsa_config ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE POLICY "Tenant isolation for tsa_config" ON tsa_config
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));


-- ── Table: tsa_timestamps ──
ALTER TABLE public.tsa_timestamps ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE POLICY "Tenant isolation for tsa_timestamps" ON tsa_timestamps
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

