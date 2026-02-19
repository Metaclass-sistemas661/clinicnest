-- ============================================================
-- MIGRAÇÃO: Tabelas Médicas para ClinicaFlow
-- Arquivo: 20260319110000_medical_tables_v1.sql
-- Descrição: Adiciona tabelas clínicas ao esquema multi-tenant
-- Segue o padrão de segurança do projeto:
--   - get_user_tenant_id() / is_tenant_admin() (SECURITY DEFINER)
--   - Policies separadas por operação com TO authenticated
--   - FORCE ROW LEVEL SECURITY
--   - updated_at triggers
-- ============================================================

-- ============================================================
-- 1. ESPECIALIDADES MÉDICAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.specialties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  color                TEXT DEFAULT '#3B82F6',
  avg_duration_minutes INTEGER DEFAULT 30,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties FORCE ROW LEVEL SECURITY;

CREATE POLICY "specialties_select" ON public.specialties
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "specialties_insert" ON public.specialties
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "specialties_update" ON public.specialties
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "specialties_delete" ON public.specialties
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_specialties_updated_at
  BEFORE UPDATE ON public.specialties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. CONVÊNIOS / PLANOS DE SAÚDE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.insurance_plans (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  ans_code               TEXT,
  contact_phone          TEXT,
  contact_email          TEXT,
  reimbursement_days     INTEGER DEFAULT 30,
  requires_authorization BOOLEAN DEFAULT FALSE,
  tiss_version           TEXT,
  notes                  TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY "insurance_plans_select" ON public.insurance_plans
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "insurance_plans_insert" ON public.insurance_plans
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "insurance_plans_update" ON public.insurance_plans
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "insurance_plans_delete" ON public.insurance_plans
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_insurance_plans_updated_at
  BEFORE UPDATE ON public.insurance_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. SALAS / CONSULTÓRIOS
-- (criada antes de medical_records para poder ser referenciada)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  capacity    INTEGER DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms FORCE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "rooms_delete" ON public.rooms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- ============================================================
-- 4. PRONTUÁRIOS ELETRÔNICOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medical_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  specialty_id    UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  chief_complaint TEXT,
  anamnesis       TEXT,
  physical_exam   TEXT,
  diagnosis       TEXT,
  cid_code        TEXT,
  treatment_plan  TEXT,
  prescriptions   TEXT,
  notes           TEXT,
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  is_confidential BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records FORCE ROW LEVEL SECURITY;

CREATE POLICY "medical_records_select" ON public.medical_records
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_records_insert" ON public.medical_records
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_records_update" ON public.medical_records
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_records_delete" ON public.medical_records
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_medical_records_client      ON public.medical_records(client_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_tenant_date ON public.medical_records(tenant_id, record_date DESC);

-- ============================================================
-- 5. TRIAGEM & ANAMNESE INICIAL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.triage_records (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id                UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id           UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  performed_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  triaged_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  priority                 TEXT NOT NULL DEFAULT 'nao_urgente'
                             CHECK (priority IN ('emergencia','urgente','pouco_urgente','nao_urgente')),
  blood_pressure_systolic  INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate               INTEGER,
  respiratory_rate         INTEGER,
  temperature              NUMERIC(4,1),
  oxygen_saturation        NUMERIC(5,1),
  weight_kg                NUMERIC(5,1),
  height_cm                INTEGER,
  chief_complaint          TEXT NOT NULL,
  pain_scale               INTEGER CHECK (pain_scale BETWEEN 0 AND 10),
  allergies                TEXT,
  current_medications      TEXT,
  medical_history          TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.triage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_records FORCE ROW LEVEL SECURITY;

CREATE POLICY "triage_records_select" ON public.triage_records
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "triage_records_insert" ON public.triage_records
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "triage_records_update" ON public.triage_records
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "triage_records_delete" ON public.triage_records
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_triage_records_client ON public.triage_records(client_id);
CREATE INDEX IF NOT EXISTS idx_triage_records_tenant ON public.triage_records(tenant_id, triaged_at DESC);

-- ============================================================
-- 6. RECEITUÁRIOS DIGITAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id    UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prescription_type TEXT NOT NULL DEFAULT 'simples'
                      CHECK (prescription_type IN ('simples','especial_b','especial_a','antimicrobiano')),
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validity_days     INTEGER DEFAULT 30,
  expires_at        TIMESTAMPTZ,              -- Calculado pela aplicação
  medications       TEXT NOT NULL,
  instructions      TEXT,
  status            TEXT NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo','expirado','cancelado')),
  digital_signature TEXT,
  printed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_select" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "prescriptions_insert" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "prescriptions_update" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "prescriptions_delete" ON public.prescriptions
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_prescriptions_client ON public.prescriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant  ON public.prescriptions(tenant_id, issued_at DESC);

-- ============================================================
-- 7. LAUDOS & RESULTADOS DE EXAMES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exam_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  requested_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  exam_type        TEXT NOT NULL DEFAULT 'laboratorial'
                     CHECK (exam_type IN ('laboratorial','imagem','eletrocardiograma','biopsia','funcional','outro')),
  exam_name        TEXT NOT NULL,
  performed_at     DATE,
  lab_name         TEXT,
  result_text      TEXT,
  reference_values TEXT,
  interpretation   TEXT,
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','normal','alterado','critico')),
  file_url         TEXT,
  file_name        TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results FORCE ROW LEVEL SECURITY;

CREATE POLICY "exam_results_select" ON public.exam_results
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "exam_results_insert" ON public.exam_results
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "exam_results_update" ON public.exam_results
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "exam_results_delete" ON public.exam_results
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_exam_results_updated_at
  BEFORE UPDATE ON public.exam_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_exam_results_client        ON public.exam_results(client_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_tenant_status ON public.exam_results(tenant_id, status);

-- ============================================================
-- 8. TERMOS DE CONSENTIMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consent_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id    UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  form_type         TEXT NOT NULL DEFAULT 'geral',
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,
  signed_at         TIMESTAMPTZ,
  signed_by_name    TEXT,
  signature_data    TEXT,
  ip_address        TEXT,
  witnessed_by      UUID REFERENCES public.profiles(id),
  is_revoked        BOOLEAN DEFAULT FALSE,
  revoked_at        TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_forms FORCE ROW LEVEL SECURITY;

CREATE POLICY "consent_forms_select" ON public.consent_forms
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "consent_forms_insert" ON public.consent_forms
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "consent_forms_update" ON public.consent_forms
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "consent_forms_delete" ON public.consent_forms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- ============================================================
-- ALTERAÇÕES EM TABELAS EXISTENTES
-- ============================================================

-- Campos médicos → CLIENTES (pacientes)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf                   TEXT,
  ADD COLUMN IF NOT EXISTS birth_date            DATE,
  ADD COLUMN IF NOT EXISTS gender                TEXT CHECK (gender IN ('M','F','O','NI')),
  ADD COLUMN IF NOT EXISTS blood_type            TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','ND')),
  ADD COLUMN IF NOT EXISTS insurance_plan_id     UUID REFERENCES public.insurance_plans(id),
  ADD COLUMN IF NOT EXISTS insurance_card_number TEXT,
  ADD COLUMN IF NOT EXISTS address_street        TEXT,
  ADD COLUMN IF NOT EXISTS address_city          TEXT,
  ADD COLUMN IF NOT EXISTS address_state         TEXT,
  ADD COLUMN IF NOT EXISTS address_zip           TEXT,
  ADD COLUMN IF NOT EXISTS emergency_name        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_phone       TEXT,
  ADD COLUMN IF NOT EXISTS occupation            TEXT;

-- Campos médicos → SERVIÇOS (procedimentos)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS specialty_id      UUID REFERENCES public.specialties(id),
  ADD COLUMN IF NOT EXISTS service_type      TEXT DEFAULT 'consulta'
                               CHECK (service_type IN ('consulta','retorno','procedimento','exame','cirurgia','terapia','outro')),
  ADD COLUMN IF NOT EXISTS tuss_code         TEXT,
  ADD COLUMN IF NOT EXISTS cbhpm_code        TEXT,
  ADD COLUMN IF NOT EXISTS insurance_plan_id UUID REFERENCES public.insurance_plans(id),
  ADD COLUMN IF NOT EXISTS insurance_price   NUMERIC(10,2);

-- Campos médicos → AGENDAMENTOS (consultas)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS consultation_type       TEXT DEFAULT 'primeira'
                               CHECK (consultation_type IN ('primeira','retorno','urgencia','procedimento','exame')),
  ADD COLUMN IF NOT EXISTS specialty_id            UUID REFERENCES public.specialties(id),
  ADD COLUMN IF NOT EXISTS room_id                 UUID REFERENCES public.rooms(id),
  ADD COLUMN IF NOT EXISTS insurance_plan_id       UUID REFERENCES public.insurance_plans(id),
  ADD COLUMN IF NOT EXISTS insurance_authorization TEXT,
  ADD COLUMN IF NOT EXISTS cid_code                TEXT,
  ADD COLUMN IF NOT EXISTS telemedicine            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telemedicine_url        TEXT;

-- Campos médicos → TENANTS (clínica)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cnpj               TEXT,
  ADD COLUMN IF NOT EXISTS medical_license    TEXT,
  ADD COLUMN IF NOT EXISTS cnes_code          TEXT,
  ADD COLUMN IF NOT EXISTS clinic_type        TEXT DEFAULT 'clinica_geral',
  ADD COLUMN IF NOT EXISTS responsible_doctor TEXT,
  ADD COLUMN IF NOT EXISTS responsible_crm    TEXT,
  ADD COLUMN IF NOT EXISTS anvisa_license     TEXT,
  ADD COLUMN IF NOT EXISTS logo_url           TEXT;

-- ============================================================
-- ÍNDICES ADICIONAIS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_cpf                    ON public.clients(tenant_id, cpf);
CREATE INDEX IF NOT EXISTS idx_clients_insurance              ON public.clients(insurance_plan_id);
CREATE INDEX IF NOT EXISTS idx_appointments_specialty         ON public.appointments(specialty_id);
CREATE INDEX IF NOT EXISTS idx_appointments_consultation_type ON public.appointments(tenant_id, consultation_type);
CREATE INDEX IF NOT EXISTS idx_services_specialty             ON public.services(specialty_id);

-- ============================================================
-- COMENTÁRIOS DESCRITIVOS
-- ============================================================
COMMENT ON TABLE public.medical_records  IS 'Prontuários eletrônicos dos pacientes';
COMMENT ON TABLE public.triage_records   IS 'Triagem com sinais vitais e classificação de risco (Manchester)';
COMMENT ON TABLE public.prescriptions    IS 'Receituários digitais emitidos pelos médicos';
COMMENT ON TABLE public.exam_results     IS 'Laudos e resultados de exames';
COMMENT ON TABLE public.specialties      IS 'Especialidades médicas oferecidas pela clínica';
COMMENT ON TABLE public.insurance_plans  IS 'Convênios e planos de saúde credenciados';
COMMENT ON TABLE public.rooms            IS 'Salas e consultórios da clínica';
COMMENT ON TABLE public.consent_forms    IS 'Termos de consentimento informado';

COMMENT ON COLUMN public.clients.cpf               IS 'CPF do paciente — formato 000.000.000-00';
COMMENT ON COLUMN public.clients.insurance_plan_id  IS 'Convênio principal do paciente';
COMMENT ON COLUMN public.appointments.consultation_type IS 'primeira=1ª consulta, retorno=acompanhamento';
COMMENT ON COLUMN public.appointments.telemedicine      IS 'TRUE = videoconsulta (telemedicina)';
COMMENT ON COLUMN public.services.tuss_code             IS 'Código TUSS para faturamento em planos de saúde';
COMMENT ON COLUMN public.tenants.cnes_code              IS 'Código CNES obrigatório para SUS/ANS';
