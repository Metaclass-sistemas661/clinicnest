-- Missing RLS Policies for 004_patient_portal
-- 8 policies for tables added in missing_tables phase

-- Table: email_verification_codes
CREATE POLICY "service_role_full_access"
  ON public.email_verification_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table: patient_activity_log
CREATE POLICY "patient_activity_log_select_own"
  ON public.patient_activity_log
  FOR SELECT
  TO authenticated
  USING (patient_user_id = current_setting('app.current_user_id')::uuid);

-- Table: patient_deletion_requests
CREATE POLICY "patient_own_deletion_requests"
  ON public.patient_deletion_requests
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Table: patient_uploaded_exams
CREATE POLICY "patient_uploaded_exams_delete_own"
  ON public.patient_uploaded_exams FOR DELETE TO authenticated
  USING (user_id = current_setting('app.current_user_id')::uuid AND status = 'pendente');

-- Table: patient_uploaded_exams
CREATE POLICY "patient_uploaded_exams_insert_own"
  ON public.patient_uploaded_exams FOR INSERT TO authenticated
  WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);

-- Table: patient_uploaded_exams
CREATE POLICY "patient_uploaded_exams_select_own"
  ON public.patient_uploaded_exams FOR SELECT TO authenticated
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Table: patient_uploaded_exams
CREATE POLICY "patient_uploaded_exams_select_tenant"
  ON public.patient_uploaded_exams FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Table: patient_uploaded_exams
CREATE POLICY "patient_uploaded_exams_update_tenant"
  ON public.patient_uploaded_exams FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid))
  WITH CHECK (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

