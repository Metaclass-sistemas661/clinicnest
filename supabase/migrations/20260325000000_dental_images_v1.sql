-- Migration: Dental Images (Intraoral Photos & Radiographs)
-- Fase 25B.5 e 25B.6 - Fotos intraorais e radiografias digitais

-- Tabela para armazenar imagens odontológicas
CREATE TABLE IF NOT EXISTS dental_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Tipo de imagem
  image_type TEXT NOT NULL CHECK (image_type IN (
    'intraoral_frontal',
    'intraoral_lateral_direita',
    'intraoral_lateral_esquerda',
    'intraoral_oclusal_superior',
    'intraoral_oclusal_inferior',
    'intraoral_outro',
    'rx_panoramica',
    'rx_periapical',
    'rx_interproximal',
    'rx_oclusal',
    'tomografia',
    'outro'
  )),
  
  -- Metadados da imagem
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Informações clínicas
  tooth_numbers INTEGER[], -- Dentes relacionados (se aplicável)
  description TEXT,
  clinical_notes TEXT,
  
  -- Radiografia específica
  rx_technique TEXT, -- Técnica radiográfica (bissetriz, paralelismo, etc.)
  rx_exposure_params TEXT, -- Parâmetros de exposição (kV, mA, tempo)
  
  -- Auditoria
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dental_images_tenant ON dental_images(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dental_images_client ON dental_images(client_id);
CREATE INDEX IF NOT EXISTS idx_dental_images_type ON dental_images(image_type);
CREATE INDEX IF NOT EXISTS idx_dental_images_record ON dental_images(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_dental_images_captured ON dental_images(captured_at DESC);

-- RLS
ALTER TABLE dental_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dental_images_tenant_isolation" ON dental_images
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER set_dental_images_updated_at
  BEFORE UPDATE ON dental_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket para imagens odontológicas (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dental-images',
  'dental-images',
  false,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/dicom', 'application/dicom']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "dental_images_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'dental-images' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "dental_images_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'dental-images' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "dental_images_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'dental-images' AND
    (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Função para listar imagens de um paciente
CREATE OR REPLACE FUNCTION get_client_dental_images(
  p_tenant_id UUID,
  p_client_id UUID,
  p_image_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  image_type TEXT,
  file_name TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  tooth_numbers INTEGER[],
  description TEXT,
  clinical_notes TEXT,
  rx_technique TEXT,
  captured_at TIMESTAMPTZ,
  professional_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    di.id,
    di.image_type,
    di.file_name,
    di.file_path,
    di.file_size,
    di.mime_type,
    di.tooth_numbers,
    di.description,
    di.clinical_notes,
    di.rx_technique,
    di.captured_at,
    p.full_name AS professional_name
  FROM dental_images di
  LEFT JOIN profiles p ON di.professional_id = p.id
  WHERE di.tenant_id = p_tenant_id
    AND di.client_id = p_client_id
    AND (p_image_type IS NULL OR di.image_type = p_image_type)
  ORDER BY di.captured_at DESC;
END;
$$;

COMMENT ON TABLE dental_images IS 'Imagens odontológicas: fotos intraorais e radiografias digitais';
COMMENT ON COLUMN dental_images.image_type IS 'Tipo da imagem: intraoral_*, rx_*, tomografia, outro';
COMMENT ON COLUMN dental_images.tooth_numbers IS 'Array de números dos dentes relacionados à imagem';
