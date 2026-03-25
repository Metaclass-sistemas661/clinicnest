-- =====================================================
-- Permitir que pacientes leiam PDFs de consentimento
-- do tenant ao qual pertencem.
--
-- A policy existente "Tenant members can read consent PDFs"
-- usa get_user_tenant_id() que busca em profiles.tenant_id.
-- Pacientes (account_type = 'patient') não possuem registro
-- em profiles, apenas em patients, então o SELECT falhava
-- com 404 ao tentar gerar signed URL.
-- =====================================================

CREATE POLICY "Patients can read their tenant consent PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'consent-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.email = auth.jwt()->>'email'
    AND p.tenant_id = (storage.foldername(name))[1]::uuid
  )
);
