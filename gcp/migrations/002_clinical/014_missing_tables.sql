-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (002_clinical)
-- 22 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE TABLE IF NOT EXISTS adverse_events_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adverse_event_id UUID NOT NULL REFERENCES adverse_events(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.adverse_events_attachments ENABLE ROW LEVEL SECURITY;

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE TABLE IF NOT EXISTS adverse_events_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adverse_event_id UUID NOT NULL REFERENCES adverse_events(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL, -- 'STATUS_CHANGE', 'UPDATE', 'COMMENT'
  old_status adverse_event_status,
  new_status adverse_event_status,
  comentario TEXT,
  dados_alterados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.adverse_events_history ENABLE ROW LEVEL SECURITY;

-- Source: 20260318200000_aesthetic_anamnesis_protocols.sql
CREATE TABLE IF NOT EXISTS aesthetic_anamnesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  fitzpatrick TEXT DEFAULT '',
  skin_type TEXT DEFAULT '',
  allergies TEXT DEFAULT '',
  isotretinoin BOOLEAN DEFAULT FALSE,
  pregnant BOOLEAN DEFAULT FALSE,
  previous_procedures TEXT DEFAULT '',
  expectations TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, patient_id)
);

ALTER TABLE public.aesthetic_anamnesis ENABLE ROW LEVEL SECURITY;

-- Source: 20260318200000_aesthetic_anamnesis_protocols.sql
CREATE TABLE IF NOT EXISTS aesthetic_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  procedure TEXT NOT NULL DEFAULT '',
  total_sessions INT NOT NULL DEFAULT 4,
  completed_sessions INT NOT NULL DEFAULT 0,
  interval_days INT NOT NULL DEFAULT 30,
  next_session_date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.aesthetic_protocols ENABLE ROW LEVEL SECURITY;

-- Source: 20260326000000_patient_portal_scheduling_v1.sql
CREATE TABLE IF NOT EXISTS public.appointment_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

ALTER TABLE public.appointment_ratings ENABLE ROW LEVEL SECURITY;

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE TABLE IF NOT EXISTS archived_clinical_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação do paciente
  client_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_cpf TEXT,
  client_cns TEXT,
  client_birth_date DATE,
  
  -- Dados arquivados (JSON completo)
  medical_records JSONB NOT NULL DEFAULT '[]',
  prescriptions JSONB NOT NULL DEFAULT '[]',
  triages JSONB NOT NULL DEFAULT '[]',
  evolutions JSONB NOT NULL DEFAULT '[]',
  attachments JSONB NOT NULL DEFAULT '[]',
  
  -- Metadados
  last_appointment_date DATE NOT NULL,
  retention_expired_at DATE NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by UUID,
  
  -- Exportação
  export_pdf_url TEXT,
  export_xml_url TEXT,
  export_generated_at TIMESTAMPTZ,
  
  -- Hash de integridade
  data_hash TEXT NOT NULL,
  
  -- Controle
  can_be_deleted_after DATE, -- 5 anos após arquivamento (opcional)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.archived_clinical_data ENABLE ROW LEVEL SECURITY;

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE TABLE IF NOT EXISTS public.clinic_rooms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.clinic_units(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  room_type       TEXT        NOT NULL DEFAULT 'consultation',
  capacity        INTEGER     NOT NULL DEFAULT 1,
  floor           TEXT,
  equipment       TEXT[],
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_rooms ENABLE ROW LEVEL SECURITY;

-- Source: 20260320130000_clinic_units.sql
CREATE TABLE IF NOT EXISTS public.clinic_units (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  phone          TEXT,
  address_street TEXT,
  address_city   TEXT,
  address_state  CHAR(2),
  address_zip    TEXT,
  cnes_code      TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_units ENABLE ROW LEVEL SECURITY;

-- Source: 20260323300000_clinical_evolutions_soap_v1.sql
CREATE TABLE IF NOT EXISTS public.clinical_evolutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,

  evolution_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  evolution_type  TEXT NOT NULL DEFAULT 'medica'
    CHECK (evolution_type IN ('medica','fisioterapia','fonoaudiologia','nutricao','psicologia','enfermagem','outro')),

  -- SOAP fields
  subjective      TEXT,
  objective        TEXT,
  assessment       TEXT,
  plan             TEXT,

  -- Clinical data
  cid_code        TEXT,
  vital_signs     JSONB DEFAULT '{}',

  -- Digital signature
  digital_hash    TEXT,
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_by_crm   TEXT,

  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_evolutions ENABLE ROW LEVEL SECURITY;

-- Source: 20260721000000_document_signatures_v1.sql
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('certificate','prescription','exam','report')),
  document_id uuid NOT NULL,
  signature_method text NOT NULL CHECK (signature_method IN ('facial','manual')),
  signature_path   text,          -- storage path for manual signature image
  facial_photo_path text,         -- storage path for facial photo
  ip_address  text,
  user_agent  text,
  signed_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (patient_id, document_type, document_id)
);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- Source: 20260629100000_exam_results_overhaul_v1.sql
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

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE TABLE IF NOT EXISTS public.nursing_evolutions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id    UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  evolution_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NANDA
  nanda_code        TEXT,
  nanda_diagnosis   TEXT NOT NULL,
  -- NIC
  nic_code          TEXT,
  nic_intervention  TEXT,
  nic_activities    TEXT,
  -- NOC
  noc_code          TEXT,
  noc_outcome       TEXT,
  noc_score_initial INTEGER CHECK (noc_score_initial BETWEEN 1 AND 5),
  noc_score_current INTEGER CHECK (noc_score_current BETWEEN 1 AND 5),
  noc_score_target  INTEGER CHECK (noc_score_target  BETWEEN 1 AND 5),
  -- Geral
  notes             TEXT,
  vital_signs       JSONB,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nursing_evolutions ENABLE ROW LEVEL SECURITY;

-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
CREATE TABLE IF NOT EXISTS public.pre_consultation_forms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES procedures(id) ON DELETE SET NULL,
  name        text NOT NULL,
  description text,
  fields      jsonb NOT NULL DEFAULT '[]',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pre_consultation_forms ENABLE ROW LEVEL SECURITY;

-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
CREATE TABLE IF NOT EXISTS public.pre_consultation_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  form_id         uuid NOT NULL REFERENCES pre_consultation_forms(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL,
  responses       jsonb NOT NULL DEFAULT '{}',
  submitted_at    timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pre_consultation_responses ENABLE ROW LEVEL SECURITY;

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE TABLE IF NOT EXISTS public.professional_payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    gateway_id UUID NOT NULL REFERENCES public.tenant_payment_gateways(id) ON DELETE CASCADE,
    provider public.payment_gateway_provider NOT NULL,
    recipient_id TEXT,
    wallet_id TEXT,
    account_id TEXT,
    pix_key TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, professional_id, gateway_id)
);

ALTER TABLE public.professional_payment_accounts ENABLE ROW LEVEL SECURITY;

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE TABLE IF NOT EXISTS public.profile_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Tipo de certificado
  certificate_type public.certificate_type NOT NULL DEFAULT 'A1',
  
  -- Dados do certificado (extraídos do X.509)
  common_name TEXT NOT NULL,
  cpf_cnpj TEXT,
  issuer TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  not_before TIMESTAMPTZ NOT NULL,
  not_after TIMESTAMPTZ NOT NULL,
  thumbprint TEXT NOT NULL,
  
  -- Para A1: certificado criptografado (AES-256-GCM)
  encrypted_pfx BYTEA,
  encryption_iv BYTEA,
  encryption_salt BYTEA,
  
  -- Para A3: apenas referência (certificado fica no token)
  a3_thumbprint TEXT,
  
  -- Para cloud: credenciais OAuth
  cloud_provider TEXT,
  cloud_credential_id TEXT,
  cloud_access_token TEXT,
  cloud_refresh_token TEXT,
  cloud_token_expires_at TIMESTAMPTZ,
  
  -- Metadados
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT unique_profile_thumbprint UNIQUE(profile_id, thumbprint)
);

ALTER TABLE public.profile_certificates ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TABLE IF NOT EXISTS prontuario_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Paciente
  client_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_name VARCHAR(200) NOT NULL,
  client_cpf VARCHAR(14),
  
  -- Conteúdo exportado
  include_prontuarios BOOLEAN DEFAULT true,
  include_receituarios BOOLEAN DEFAULT true,
  include_atestados BOOLEAN DEFAULT true,
  include_laudos BOOLEAN DEFAULT true,
  include_evolucoes BOOLEAN DEFAULT true,
  include_exames BOOLEAN DEFAULT true,
  include_anexos BOOLEAN DEFAULT true,
  
  -- Período
  data_inicio DATE,
  data_fim DATE,
  
  -- Arquivos gerados
  pdf_url TEXT,
  pdf_size_bytes INTEGER,
  xml_url TEXT,
  xml_size_bytes INTEGER,
  zip_url TEXT,
  zip_size_bytes INTEGER,
  
  -- Hash para verificação
  content_hash TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  
  -- TSA (opcional)
  tsa_timestamp_id UUID REFERENCES tsa_timestamps(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'processing',
  error_message TEXT,
  
  -- Solicitação
  requested_by UUID,
  requested_reason TEXT,
  
  -- Download
  download_count INTEGER DEFAULT 0,
  last_download_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prontuario_exports ENABLE ROW LEVEL SECURITY;

-- Source: 20260320100000_record_templates.sql
CREATE TABLE IF NOT EXISTS public.record_field_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  specialty_id UUID        REFERENCES public.specialties(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  -- fields JSONB: [{name, label, type, required, options?, placeholder?}]
  -- type: text | textarea | number | date | select | boolean
  fields       JSONB       NOT NULL DEFAULT '[]',
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.record_field_templates ENABLE ROW LEVEL SECURITY;

-- Source: 20260328600000_return_notification_v1.sql
CREATE TABLE IF NOT EXISTS return_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES return_reminders(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  action TEXT, -- 'confirmed', 'cancelled', 'rescheduled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT return_confirmation_tokens_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

ALTER TABLE public.return_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Source: 20260324800000_return_automation_v1.sql
CREATE TABLE IF NOT EXISTS return_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Origem
  medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Paciente e profissional
  client_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  
  -- Configuração do retorno
  return_days INTEGER NOT NULL, -- Dias para retorno (7, 15, 30, 60, 90, etc)
  return_date DATE NOT NULL, -- Data calculada do retorno
  reason TEXT, -- Motivo do retorno
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Aguardando retorno
    'notified',     -- Paciente notificado
    'scheduled',    -- Agendamento criado
    'completed',    -- Retorno realizado
    'cancelled',    -- Cancelado
    'expired'       -- Expirado (paciente não retornou)
  )),
  
  -- Agendamento vinculado (se pré-agendado)
  scheduled_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Notificações
  notify_patient BOOLEAN NOT NULL DEFAULT TRUE,
  notify_days_before INTEGER DEFAULT 3, -- Notificar X dias antes
  last_notification_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0,
  
  -- Contato preferencial
  preferred_contact TEXT CHECK (preferred_contact IN ('whatsapp', 'email', 'sms', 'phone')),
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.return_reminders ENABLE ROW LEVEL SECURITY;

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE TABLE IF NOT EXISTS public.room_occupancies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  room_id         UUID        NOT NULL REFERENCES public.clinic_rooms(id) ON DELETE CASCADE,
  appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name     TEXT,
  status          TEXT        NOT NULL DEFAULT 'occupied',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  notes           TEXT
);

ALTER TABLE public.room_occupancies ENABLE ROW LEVEL SECURITY;

-- Source: 20260704500000_waitlist_auto_notify_on_cancel.sql
CREATE TABLE IF NOT EXISTS public.waitlist_notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  waitlist_id      uuid NOT NULL REFERENCES public.waitlist(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL,
  appointment_date timestamptz NOT NULL,
  service_id       uuid,
  professional_id  uuid,
  period           text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.waitlist_notifications ENABLE ROW LEVEL SECURITY;

