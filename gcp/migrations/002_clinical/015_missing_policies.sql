-- Missing RLS Policies for 002_clinical
-- 9 policies for tables added in missing_tables phase

-- Table: aesthetic_anamnesis
CREATE POLICY "tenant_isolation_aesthetic_anamnesis"
  ON aesthetic_anamnesis FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));

-- Table: aesthetic_protocols
CREATE POLICY "tenant_isolation_aesthetic_protocols"
  ON aesthetic_protocols FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));

-- Table: archived_clinical_data
CREATE POLICY "archived_clinical_data_tenant_isolation" 
ON archived_clinical_data FOR ALL 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1));

-- Table: document_signatures
CREATE POLICY "document_signatures_select_own"
  ON public.document_signatures FOR SELECT
  USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Table: document_signatures
CREATE POLICY "document_signatures_select_tenant"
  ON public.document_signatures FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = current_setting('app.current_user_id')::uuid
    )
  );

-- Table: prontuario_exports
CREATE POLICY "tenant_admin_delete_prontuario_exports"
  ON public.prontuario_exports FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: prontuario_exports
CREATE POLICY "tenant_admin_insert_prontuario_exports"
  ON public.prontuario_exports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: prontuario_exports
CREATE POLICY "tenant_admin_select_prontuario_exports"
  ON public.prontuario_exports FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: prontuario_exports
CREATE POLICY "tenant_admin_update_prontuario_exports"
  ON public.prontuario_exports FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

