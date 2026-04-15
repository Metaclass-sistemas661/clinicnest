-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (008_integrations)
-- 5 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260330900000_document_verification_v1.sql
CREATE TABLE IF NOT EXISTS public.document_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type verifiable_document_type NOT NULL,
  document_id UUID NOT NULL,
  document_hash TEXT NOT NULL,
  verification_result BOOLEAN NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verifier_ip INET,
  verifier_user_agent TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE TABLE IF NOT EXISTS hl7_patient_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES hl7_connections(id) ON DELETE SET NULL,
    
    -- External ID (from lab/hospital)
    external_patient_id TEXT NOT NULL,
    external_system TEXT, -- e.g., 'LAB_XYZ', 'HOSPITAL_ABC'
    
    -- Internal ID
    client_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    
    -- Matching info
    matched_by TEXT, -- 'cpf', 'name_dob', 'manual', 'auto'
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Status
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, external_patient_id, external_system)
);

ALTER TABLE public.hl7_patient_mapping ENABLE ROW LEVEL SECURITY;

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE TABLE IF NOT EXISTS public.incoming_rnds_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Dados do bundle FHIR
  bundle_type TEXT NOT NULL DEFAULT 'document',  -- document, message, transaction
  fhir_bundle JSONB NOT NULL,
  bundle_id TEXT, -- Bundle.id do FHIR original
  
  -- Origem
  source_cnes TEXT,           -- CNES do estabelecimento de origem
  source_name TEXT,           -- Nome do estabelecimento
  source_uf TEXT,
  
  -- Paciente (deduplicação)
  patient_cpf TEXT,
  patient_name TEXT,
  matched_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  
  -- Recursos extraídos (cache)
  resource_types TEXT[], -- ex: ['Condition','Observation','MedicationRequest']
  resource_count INT DEFAULT 0,
  
  -- Status de review
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','reviewed','accepted','rejected','merged')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Metadados
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.incoming_rnds_bundles ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TABLE IF NOT EXISTS tsa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Provedor
  provider tsa_provider NOT NULL DEFAULT 'certisign',
  
  -- Credenciais (criptografadas na aplicação)
  api_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  certificate_path TEXT,
  certificate_password_encrypted TEXT,
  
  -- Configurações
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  policy_oid VARCHAR(100),
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  last_test_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  last_error TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  UNIQUE(tenant_id)
);

ALTER TABLE public.tsa_config ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TABLE IF NOT EXISTS tsa_timestamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Documento carimbado
  document_type tsa_document_type NOT NULL,
  document_id UUID NOT NULL,
  document_table VARCHAR(100) NOT NULL,
  
  -- Hash do documento original
  document_hash TEXT NOT NULL,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  
  -- Resposta TSA
  status tsa_status NOT NULL DEFAULT 'pending',
  timestamp_token BYTEA,
  timestamp_token_base64 TEXT,
  serial_number VARCHAR(100),
  
  -- Dados do carimbo
  tsa_time TIMESTAMPTZ,
  tsa_policy_oid VARCHAR(100),
  tsa_provider tsa_provider,
  tsa_response JSONB,
  
  -- Verificação
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_result JSONB,
  
  -- Erro (se houver)
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID -- --
);

ALTER TABLE public.tsa_timestamps ENABLE ROW LEVEL SECURITY;

