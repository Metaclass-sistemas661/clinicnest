-- ============================================================
-- MIGRAÇÃO: Sinais Vitais Estruturados no Prontuário
-- Arquivo: 20260322400000_medical_records_vital_signs_v1.sql
-- Descrição: Adiciona campos numéricos de sinais vitais à tabela
--   medical_records para que os dados da triagem sejam persistidos
--   de forma estruturada (não apenas texto na anamnese).
--   Permite gráficos de tendência, alertas clínicos e exportação HL7/FHIR.
-- ============================================================

ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS blood_pressure_systolic  INTEGER,
  ADD COLUMN IF NOT EXISTS blood_pressure_diastolic INTEGER,
  ADD COLUMN IF NOT EXISTS heart_rate               INTEGER,
  ADD COLUMN IF NOT EXISTS respiratory_rate          INTEGER,
  ADD COLUMN IF NOT EXISTS temperature               NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS oxygen_saturation         NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS weight_kg                 NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS height_cm                 INTEGER,
  ADD COLUMN IF NOT EXISTS pain_scale                INTEGER CHECK (pain_scale BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS allergies                 TEXT,
  ADD COLUMN IF NOT EXISTS current_medications       TEXT,
  ADD COLUMN IF NOT EXISTS medical_history           TEXT;

COMMENT ON COLUMN public.medical_records.blood_pressure_systolic  IS 'PA sistólica (mmHg) — copiada da triagem ou aferida pelo médico';
COMMENT ON COLUMN public.medical_records.blood_pressure_diastolic IS 'PA diastólica (mmHg)';
COMMENT ON COLUMN public.medical_records.heart_rate               IS 'Frequência cardíaca (bpm)';
COMMENT ON COLUMN public.medical_records.respiratory_rate          IS 'Frequência respiratória (irpm)';
COMMENT ON COLUMN public.medical_records.temperature               IS 'Temperatura axilar (°C)';
COMMENT ON COLUMN public.medical_records.oxygen_saturation         IS 'Saturação de O₂ (%)';
COMMENT ON COLUMN public.medical_records.weight_kg                 IS 'Peso (kg)';
COMMENT ON COLUMN public.medical_records.height_cm                 IS 'Altura (cm)';
COMMENT ON COLUMN public.medical_records.pain_scale                IS 'Escala de dor (0-10)';
COMMENT ON COLUMN public.medical_records.allergies                 IS 'Alergias relatadas na triagem/anamnese';
COMMENT ON COLUMN public.medical_records.current_medications       IS 'Medicamentos em uso informados na triagem';
COMMENT ON COLUMN public.medical_records.medical_history           IS 'Histórico médico relevante informado na triagem';
