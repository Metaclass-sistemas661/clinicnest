-- ============================================================
-- GCP Cloud SQL Migration - Final Gap Fix
-- Missing enum + policies discovered in full audit
-- ============================================================

-- Missing Enum Type
CREATE TYPE adverse_event_severity AS ENUM (
  'NEAR_MISS',
  'LEVE',
  'MODERADO',
  'GRAVE',
  'OBITO'
);

-- ============================================================
-- Missing Policies (public schema)
-- ============================================================

-- Table: backup_logs
CREATE POLICY "tenant_admin_delete_backup_logs"
  ON public.backup_logs FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: backup_logs
CREATE POLICY "tenant_admin_insert_backup_logs"
  ON public.backup_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: backup_logs
CREATE POLICY "tenant_admin_select_backup_logs"
  ON public.backup_logs FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: backup_logs
CREATE POLICY "tenant_admin_update_backup_logs"
  ON public.backup_logs FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id)
  );

-- Table: contact_messages
CREATE POLICY "anon_can_submit_contact_form_validated"
  ON public.contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Campos não vazios (trim whitespace)
    length(trim(name)) >= 2
    AND length(trim(email)) >= 5
    AND length(trim(subject)) >= 3
    AND length(trim(message)) >= 10
    -- Email precisa conter @ e .
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    -- Limite máximo para prevenir payload abuse
    AND length(message) <= 5000
    AND length(name) <= 200
    AND length(subject) <= 300
  );

-- Table: insurance_plans
CREATE POLICY "insurance_plans_select_patient"
        ON public.insurance_plans FOR SELECT
        USING (true)
    $pol$;

-- Table: patients
CREATE POLICY "patients_select_own_via_patient_profile"
  ON public.patients FOR SELECT
  USING (
    id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Table: prescriptions
CREATE POLICY "prescriptions_select_own_patient"
        ON public.prescriptions FOR SELECT
        USING (
          patient_id IN (
            SELECT pp.client_id FROM public.patient_profiles pp
            WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
          )
        )
    $pol$;

-- Table: tenants
CREATE POLICY "tenants_select_patient"
        ON public.tenants FOR SELECT
        USING (true)
    $pol$;


-- ============================================================
-- Missing Storage Policies
-- NOTE: These are Supabase storage.objects policies.
-- In GCP, storage is handled by Cloud Storage IAM/signed URLs.
-- Kept here for reference; implement equivalent in app middleware.
-- ============================================================

-- Policy: consent_photos_insert_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_photos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consent-photos'
    AND (storage.foldername(name))[1] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: consent_photos_select_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_photos_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-photos'
    AND (storage.foldername(name))[1] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: consent_photos_select_tenant_staff
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_photos_select_tenant_staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-photos'
    AND EXISTS (
      SELECT 1
      FROM public.patient_consents pc
      WHERE pc.patient_user_id::text = (storage.foldername(name))[1]
        AND pc.tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid)
    )
    AND public.get_user_tenant_id(current_setting('app.current_user_id')::uuid) IS NOT NULL
  );

-- Policy: consent_sealed_pdfs_insert_service
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_sealed_pdfs_insert_service"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (
    bucket_id = 'consent-sealed-pdfs'
  );

-- Policy: consent_sealed_pdfs_select_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_sealed_pdfs_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-sealed-pdfs'
    AND (storage.foldername(name))[2] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: consent_sealed_pdfs_select_tenant_staff
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_sealed_pdfs_select_tenant_staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-sealed-pdfs'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid)::text
    AND public.get_user_tenant_id(current_setting('app.current_user_id')::uuid) IS NOT NULL
  );

-- Policy: consent_signatures_insert_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_signatures_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consent-signatures'
    AND (storage.foldername(name))[1] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: consent_signatures_select_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_signatures_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-signatures'
    AND (storage.foldername(name))[1] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: consent_signatures_select_tenant_staff
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "consent_signatures_select_tenant_staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-signatures'
    AND EXISTS (
      SELECT 1
      FROM public.patient_consents pc
      WHERE pc.patient_user_id::text = (storage.foldername(name))[1]
        AND pc.tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid)
    )
    AND public.get_user_tenant_id(current_setting('app.current_user_id')::uuid) IS NOT NULL
  );

-- Policy: document_signatures_read_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "document_signatures_read_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'document-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT pp.client_id::text FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Policy: document_signatures_upload_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "document_signatures_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'document-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT pp.client_id::text FROM public.patient_profiles pp
      WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true
    )
  );

-- Policy: patient_exams_delete_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "patient_exams_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: patient_exams_insert_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "patient_exams_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: patient_exams_select_own
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "patient_exams_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = current_setting('app.current_user_id')::uuid::text
  );

-- Policy: patient_exams_select_tenant
-- NOTE: storage.objects → Cloud Storage IAM in GCP
-- CREATE POLICY "patient_exams_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND EXISTS (
      SELECT 1
      FROM public.patient_profiles pp
      WHERE pp.user_id = (storage.foldername(name))[1]::uuid
        AND pp.tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid)
        AND pp.is_active = true
    )
  );

