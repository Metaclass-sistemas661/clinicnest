-- =====================================================
-- APLICAR NO SQL EDITOR DO SUPABASE
-- Fix: pacientes não conseguem gerar signed URL para
-- PDFs de consentimento (400/404 "Object not found")
--
-- Causa: a policy SELECT do bucket consent-pdfs usa
-- get_user_tenant_id() que busca em profiles.tenant_id
-- mas pacientes só existem em patients, não em profiles.
-- =====================================================

-- Adicionar policy que permite pacientes lerem PDFs do seu tenant
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
