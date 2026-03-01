-- ============================================================
-- OVERHAUL: exam_results + medical_reports (CFM/TASY compliance)
-- ============================================================
-- Problemas resolvidos:
-- 1. Apenas 6 tipos de exame → 25+ tipos cobrindo TUSS completo
-- 2. Sem código TUSS → coluna tuss_code
-- 3. Sem upload de arquivo na clínica → file_url/file_name já existem
-- 4. Sem tabela medical_reports → criada para laudos médicos (LaudoDrawer)
-- 5. Sem urgência → coluna priority
-- 6. Sem profissional executor → coluna performed_by
-- ============================================================

BEGIN;

-- 1. Expandir CHECK constraint de exam_type
-- Drop e recria para incluir tipos completos (TUSS-aligned)
ALTER TABLE public.exam_results DROP CONSTRAINT IF EXISTS exam_results_exam_type_check;

ALTER TABLE public.exam_results ADD CONSTRAINT exam_results_exam_type_check
  CHECK (exam_type IN (
    -- Laboratoriais
    'laboratorial',            -- Exames de sangue, urina, fezes (hemograma, bioquímica, etc.)
    -- Imagem
    'imagem',                  -- Genérico imagem (backward compat)
    'radiografia',             -- Raio-X
    'ultrassonografia',        -- Ultrassom (US)
    'tomografia',              -- Tomografia computadorizada (TC)
    'ressonancia',             -- Ressonância magnética (RM)
    'mamografia',              -- Mamografia
    'densitometria',           -- Densitometria óssea
    'cintilografia',           -- Medicina nuclear
    'pet_ct',                  -- PET-CT
    -- Cardiologia
    'eletrocardiograma',       -- ECG (backward compat)
    'ecocardiograma',          -- Ecocardiograma
    'holter',                  -- Holter 24h
    'mapa',                    -- MAPA (Monitorização Ambulatorial PA)
    'teste_ergometrico',       -- Teste ergométrico / esteira
    'cateterismo',             -- Cateterismo cardíaco
    -- Neurofisiologia
    'eletroencefalograma',     -- EEG
    'eletroneuromiografia',    -- ENMG
    'polissonografia',         -- Polissonografia
    -- Endoscopia
    'endoscopia',              -- Endoscopia digestiva alta
    'colonoscopia',            -- Colonoscopia
    'broncoscopia',            -- Broncoscopia
    'cistoscopia',             -- Cistoscopia
    'histeroscopia',           -- Histeroscopia
    'laringoscopia',           -- Laringoscopia
    -- Anatomopatologia
    'anatomopatologico',       -- Exame anatomopatológico
    'citologico',              -- Citologia (Papanicolau, etc.)
    'biopsia',                 -- Biópsia (backward compat)
    'imunohistoquimica',       -- Imunohistoquímica
    -- Provas funcionais
    'funcional',               -- Genérico funcional (backward compat)
    'espirometria',            -- Espirometria / prova função pulmonar
    'audiometria',             -- Audiometria
    'campimetria',             -- Campimetria visual
    'colposcopia',             -- Colposcopia
    'urodinamica',             -- Estudo urodinâmico
    -- Outros
    'genetico',                -- Exame genético / molecular
    'microbiologia',           -- Cultura, antibiograma
    'outro'                    -- Outros (backward compat)
  ));

-- 2. Adicionar coluna tuss_code (código TUSS do procedimento)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exam_results' AND column_name = 'tuss_code'
  ) THEN
    ALTER TABLE public.exam_results ADD COLUMN tuss_code TEXT;
  END IF;
END $$;

-- 3. Adicionar coluna priority (urgência)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exam_results' AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.exam_results ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'
      CHECK (priority IN ('normal', 'urgente'));
  END IF;
END $$;

-- 4. Adicionar coluna performed_by (profissional que realizou/laudou)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exam_results' AND column_name = 'performed_by'
  ) THEN
    ALTER TABLE public.exam_results ADD COLUMN performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Adicionar coluna exam_category (subcategoria dentro do tipo)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exam_results' AND column_name = 'exam_category'
  ) THEN
    ALTER TABLE public.exam_results ADD COLUMN exam_category TEXT;
  END IF;
END $$;

-- 6. Índice para busca por TUSS code
CREATE INDEX IF NOT EXISTS idx_exam_results_tuss_code ON public.exam_results(tuss_code) WHERE tuss_code IS NOT NULL;

-- 7. Índice para busca por tipo de exame
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_type ON public.exam_results(tenant_id, exam_type);

-- ============================================================
-- TABELA: medical_reports (Laudos Médicos — CRM/CFM)
-- Persiste dados do LaudoDrawer (prontuário)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medical_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  medical_record_id   UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  appointment_id      UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  
  -- Tipo de laudo (CFM)
  tipo                TEXT NOT NULL DEFAULT 'medico'
                        CHECK (tipo IN (
                          'medico',           -- Laudo médico genérico
                          'pericial',         -- Laudo pericial (judicial, INSS)
                          'aptidao',          -- Atestado de aptidão (trabalho, concurso)
                          'capacidade',       -- Laudo de capacidade funcional
                          'complementar',     -- Laudo de exame complementar
                          'psicologico',      -- Laudo psicológico
                          'neuropsicologico', -- Avaliação neuropsicológica
                          'ocupacional',      -- Laudo ocupacional (NR-7)
                          'outro'
                        )),
  finalidade          TEXT,               -- Ex: "Processo judicial", "INSS", "Concurso"
  
  -- Conteúdo do laudo (CFM Res. 1.658/2002 e SBIS)
  historia_clinica    TEXT,               -- Resumo da história clínica relevante
  exame_fisico        TEXT,               -- Achados do exame físico
  exames_complementares TEXT,             -- Resultados de exames referenciados
  diagnostico         TEXT,               -- Diagnóstico principal
  cid10               TEXT,               -- Código CID-10
  conclusao           TEXT NOT NULL,      -- Conclusão / parecer médico
  observacoes         TEXT,               -- Observações adicionais
  
  -- Metadados
  status              TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho', 'finalizado', 'assinado', 'cancelado')),
  signed_at           TIMESTAMPTZ,        -- Data/hora da assinatura digital
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY "medical_reports_select" ON public.medical_reports
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_reports_insert" ON public.medical_reports
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_reports_update" ON public.medical_reports
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_reports_delete" ON public.medical_reports
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_medical_reports_updated_at
  BEFORE UPDATE ON public.medical_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_medical_reports_tenant    ON public.medical_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_patient   ON public.medical_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_record    ON public.medical_reports(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_prof      ON public.medical_reports(professional_id);

COMMENT ON TABLE public.medical_reports IS 'Laudos médicos (CFM Res. 1.658/2002) - persistência do LaudoDrawer';
COMMENT ON TABLE public.exam_results   IS 'Resultados de exames (laboratoriais, imagem, funcionais, etc.) com TUSS';

COMMIT;
