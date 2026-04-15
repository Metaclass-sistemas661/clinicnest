-- ============================================================
-- ClinicaFlow GCP Migration: Cloud Storage bucket definitions
-- Equivalente aos buckets do Supabase Storage
-- Executar via gsutil ou Terraform, não SQL
-- ============================================================

-- Este arquivo é REFERÊNCIA para criação dos buckets no Cloud Storage.
-- Usar o script gcp/secrets/deploy-storage.sh para criar.

-- Bucket: clinicaflow-avatars
--   Conteúdo: Fotos de perfil de usuários e profissionais
--   Max file size: 10 MB
--   Formato: image/jpeg, image/png, image/webp
--   Acesso: Público (via CDN)

-- Bucket: clinicaflow-consent
--   Conteúdo: PDFs de termos, fotos faciais, assinaturas, PDFs selados
--   Sub-pastas: pdfs/, photos/, signatures/, sealed/
--   Max file size: 10 MB
--   Formato: application/pdf, image/jpeg, image/png
--   Acesso: Signed URLs (privado)

-- Bucket: clinicaflow-dental
--   Conteúdo: Raio-X, fotos intraorais, CT scans, anexos odontológicos
--   Max file size: 50 MB
--   Formato: image/jpeg, image/png, application/dicom
--   Acesso: Signed URLs (privado)

-- Bucket: clinicaflow-exams
--   Conteúdo: Resultados de exames, uploads de pacientes
--   Max file size: 20 MB
--   Formato: application/pdf, image/jpeg, image/png
--   Acesso: Signed URLs (privado)

-- Bucket: clinicaflow-campaigns
--   Conteúdo: Banners de email marketing
--   Max file size: 5 MB
--   Formato: image/jpeg, image/png, image/gif
--   Acesso: Público (via CDN)

-- Bucket: clinicaflow-chat
--   Conteúdo: Anexos do chat interno
--   Max file size: 10 MB
--   Formato: Qualquer
--   Acesso: Signed URLs (privado)

-- Bucket: clinicaflow-signatures
--   Conteúdo: Assinaturas digitais de documentos
--   Max file size: 5 MB
--   Formato: image/png, application/pdf
--   Acesso: Signed URLs (privado)
