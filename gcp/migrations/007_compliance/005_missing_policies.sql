-- Missing RLS Policies for 007_compliance
-- 9 policies for tables added in missing_tables phase

-- Table: retention_deletion_attempts
CREATE POLICY "retention_deletion_attempts_tenant_isolation" 
ON retention_deletion_attempts FOR ALL 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1));

-- Table: ripd_reports
CREATE POLICY "tenant_admin_delete_ripd_reports"
  ON public.ripd_reports FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: ripd_reports
CREATE POLICY "tenant_admin_insert_ripd_reports"
  ON public.ripd_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: ripd_reports
CREATE POLICY "tenant_admin_select_ripd_reports"
  ON public.ripd_reports FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: ripd_reports
CREATE POLICY "tenant_admin_update_ripd_reports"
  ON public.ripd_reports FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: sbis_documentation
CREATE POLICY "tenant_admin_delete_sbis_documentation"
  ON public.sbis_documentation FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: sbis_documentation
CREATE POLICY "tenant_admin_insert_sbis_documentation"
  ON public.sbis_documentation FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: sbis_documentation
CREATE POLICY "tenant_admin_select_sbis_documentation"
  ON public.sbis_documentation FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: sbis_documentation
CREATE POLICY "tenant_admin_update_sbis_documentation"
  ON public.sbis_documentation FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

