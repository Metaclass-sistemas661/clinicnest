-- ============================================================
-- Patient Exam Uploads: table, storage bucket, RLS & RPCs
-- Allows patients to upload their own external exam files
-- ============================================================

-- 1. TABLE: patient_uploaded_exams
CREATE TABLE IF NOT EXISTS public.patient_uploaded_exams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL,  -- references clients(id) via patient_profiles
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_path    TEXT NOT NULL,        -- storage path in bucket
  file_size    BIGINT NOT NULL DEFAULT 0,
  mime_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
  exam_name    TEXT NOT NULL DEFAULT '',
  exam_date    DATE,
  notes        TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','revisado','aprovado','rejeitado')),
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_uploaded_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_uploaded_exams FORCE ROW LEVEL SECURITY;

-- Patient can see only their own uploaded exams
CREATE POLICY "patient_uploaded_exams_select_own"
  ON public.patient_uploaded_exams FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Patient can insert only their own uploaded exams
CREATE POLICY "patient_uploaded_exams_insert_own"
  ON public.patient_uploaded_exams FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Patient can delete only their own pending uploads
CREATE POLICY "patient_uploaded_exams_delete_own"
  ON public.patient_uploaded_exams FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pendente');

-- Clinic staff can see patient uploads for their tenant
CREATE POLICY "patient_uploaded_exams_select_tenant"
  ON public.patient_uploaded_exams FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Clinic staff can update (review) patient uploads for their tenant
CREATE POLICY "patient_uploaded_exams_update_tenant"
  ON public.patient_uploaded_exams FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_patient_uploaded_exams_updated_at
  BEFORE UPDATE ON public.patient_uploaded_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_patient_uploaded_exams_user
  ON public.patient_uploaded_exams(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_uploaded_exams_tenant
  ON public.patient_uploaded_exams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_uploaded_exams_patient
  ON public.patient_uploaded_exams(patient_id);

COMMENT ON TABLE public.patient_uploaded_exams IS 'Exames/laudos enviados pelo paciente (upload)';


-- 2. STORAGE BUCKET: patient-exams
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-exams',
  'patient-exams',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg','image/jpg','image/png','image/webp',
    'application/dicom',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Patient can upload files to their own folder
CREATE POLICY "patient_exams_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Patient can read their own files
CREATE POLICY "patient_exams_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Patient can delete their own files
CREATE POLICY "patient_exams_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Clinic staff can read patient exam files for patients linked to their tenant
-- This uses a subquery check on patient_profiles
CREATE POLICY "patient_exams_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-exams'
    AND EXISTS (
      SELECT 1
      FROM public.patient_profiles pp
      WHERE pp.user_id = (storage.foldername(name))[1]::uuid
        AND pp.tenant_id = public.get_user_tenant_id(auth.uid())
        AND pp.is_active = true
    )
  );


-- 3. RPC: Patient inserts an uploaded exam record
CREATE OR REPLACE FUNCTION public.patient_upload_exam(
  p_file_name   TEXT,
  p_file_path   TEXT,
  p_file_size   BIGINT,
  p_mime_type   TEXT,
  p_exam_name   TEXT DEFAULT '',
  p_exam_date   DATE DEFAULT NULL,
  p_notes       TEXT DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_link RECORD;
  v_id   uuid;
BEGIN
  -- Get the first active patient link (tenant + patient_id)
  SELECT pp.tenant_id, pp.client_id
    INTO v_link
    FROM public.patient_profiles pp
   WHERE pp.user_id = v_uid
     AND pp.is_active = true
   LIMIT 1;

  IF v_link IS NULL THEN
    RAISE EXCEPTION 'patient_not_linked';
  END IF;

  INSERT INTO public.patient_uploaded_exams (
    tenant_id, patient_id, user_id,
    file_name, file_path, file_size, mime_type,
    exam_name, exam_date, notes
  ) VALUES (
    v_link.tenant_id, v_link.client_id, v_uid,
    p_file_name, p_file_path, p_file_size, p_mime_type,
    p_exam_name, p_exam_date, p_notes
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_upload_exam(TEXT,TEXT,BIGINT,TEXT,TEXT,DATE,TEXT) TO authenticated;


-- 4. RPC: Patient lists their uploaded exams
CREATE OR REPLACE FUNCTION public.get_patient_uploaded_exams()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
    SELECT jsonb_build_object(
      'id', pue.id,
      'file_name', pue.file_name,
      'file_path', pue.file_path,
      'file_size', pue.file_size,
      'mime_type', pue.mime_type,
      'exam_name', pue.exam_name,
      'exam_date', pue.exam_date,
      'notes', pue.notes,
      'status', pue.status,
      'reviewed_by_name', COALESCE(pr.full_name, ''),
      'reviewed_at', pue.reviewed_at,
      'created_at', pue.created_at,
      'clinic_name', COALESCE(t.name, '')
    )
    FROM public.patient_uploaded_exams pue
    LEFT JOIN public.profiles pr ON pr.id = pue.reviewed_by
    LEFT JOIN public.tenants t ON t.id = pue.tenant_id
    WHERE pue.user_id = v_uid
    ORDER BY pue.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_uploaded_exams() TO authenticated;


-- 5. RPC: Patient deletes a pending uploaded exam
CREATE OR REPLACE FUNCTION public.patient_delete_uploaded_exam(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_path TEXT;
BEGIN
  SELECT file_path INTO v_path
    FROM public.patient_uploaded_exams
   WHERE id = p_exam_id AND user_id = v_uid AND status = 'pendente';

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'exam_not_found_or_already_reviewed';
  END IF;

  DELETE FROM public.patient_uploaded_exams
  WHERE id = p_exam_id AND user_id = v_uid AND status = 'pendente';

  RETURN jsonb_build_object('success', true, 'deleted_path', v_path);
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_delete_uploaded_exam(uuid) TO authenticated;
