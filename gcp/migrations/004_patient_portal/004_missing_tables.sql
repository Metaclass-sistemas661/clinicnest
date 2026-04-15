-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (004_patient_portal)
-- 9 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260324200000_email_verification_codes.sql
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  email      text NOT NULL,
  code       text NOT NULL,
  attempts   int  NOT NULL DEFAULT 0,
  verified   boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Source: 20260724000000_security_validate_patient_access_hardening.sql
CREATE TABLE IF NOT EXISTS public.patient_access_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash TEXT NOT NULL,  -- SHA-256 do identificador (nunca armazena o CPF/código em texto plano)
  success BOOLEAN NOT NULL DEFAULT false,
  ip_hint TEXT,                   -- Apenas últimos 2 octetos para correlação, ex: "*.*.123.45"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_access_attempts ENABLE ROW LEVEL SECURITY;

-- Source: 20260724000003_patient_activity_log.sql
CREATE TABLE IF NOT EXISTS public.patient_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  event_type TEXT NOT NULL,           -- 'login' | 'profile_update' | 'exam_download' | 'prescription_view' | 'consent_sign' | 'data_export' | 'deletion_request' | 'mfa_change' | 'settings_update'
  event_description TEXT,             -- Breve descrição legível
  metadata JSONB DEFAULT '{}',        -- Dados extras (ex: template_id, exam_id)
  ip_hint TEXT,                       -- Últimos octetos apenas
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_activity_log ENABLE ROW LEVEL SECURITY;

-- Source: 20260324900000_patient_call_queue_v1.sql
CREATE TABLE IF NOT EXISTS patient_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Paciente e atendimento
  client_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  triage_id UUID REFERENCES triage_records(id) ON DELETE SET NULL,
  
  -- Destino
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  room_name TEXT,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  professional_name TEXT,
  
  -- Status da chamada
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
    'waiting',    -- Na fila de espera
    'calling',    -- Sendo chamado agora
    'called',     -- Já foi chamado
    'in_service', -- Em atendimento
    'completed',  -- Atendimento concluído
    'no_show'     -- Não compareceu
  )),
  
  -- Prioridade (da triagem)
  priority INTEGER DEFAULT 5, -- 1=emergência, 5=normal
  priority_label TEXT,
  
  -- Controle de chamada
  call_number INTEGER, -- Número sequencial do dia
  times_called INTEGER DEFAULT 0,
  first_called_at TIMESTAMPTZ,
  last_called_at TIMESTAMPTZ,
  
  -- Timestamps
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_service_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_calls ENABLE ROW LEVEL SECURITY;

-- Source: 20260724000001_lgpd_patient_data_export_deletion.sql
CREATE TABLE IF NOT EXISTS public.patient_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  user_id UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id)
);

ALTER TABLE public.patient_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Source: 20260702000000_notification_system_v2.sql
CREATE TABLE IF NOT EXISTS public.patient_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Granular opt-out por tipo
  opt_out_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, tenant_id)
);

ALTER TABLE public.patient_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE TABLE IF NOT EXISTS public.patient_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id uuid NOT NULL UNIQUE,
  
  tour_completed boolean NOT NULL DEFAULT false,
  tour_completed_at timestamptz,
  tour_skipped boolean NOT NULL DEFAULT false,
  
  first_login_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  login_count integer NOT NULL DEFAULT 1,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_onboarding ENABLE ROW LEVEL SECURITY;

-- Source: 20260616000000_patient_exam_uploads_v1.sql
CREATE TABLE IF NOT EXISTS public.patient_uploaded_exams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL,  -- REFERENCES public.patients(id) via patient_profiles
  user_id      UUID NOT NULL,
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

-- Source: 20260316300000_prescription_refill_requests.sql
CREATE TABLE IF NOT EXISTS public.prescription_refill_requests (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescription_id  uuid,               -- referência à receita original (opcional)
  medication_name  text NOT NULL,       -- nome do medicamento solicitado
  reason           text,                -- motivo do pedido
  status           text NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'scheduled'
  reviewer_id      uuid -- --
  reviewer_notes   text,                -- notas do profissional
  reviewed_at      timestamptz,
  created_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_refill_status CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled'))
);

ALTER TABLE public.prescription_refill_requests ENABLE ROW LEVEL SECURITY;

