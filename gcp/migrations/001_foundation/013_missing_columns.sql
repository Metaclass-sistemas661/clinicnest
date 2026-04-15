-- ============================================================
-- GCP Cloud SQL Migration - Missing Columns Patch
-- These columns were added via ALTER TABLE ADD COLUMN in Supabase
-- incremental migrations but are missing from GCP CREATE TABLE.
-- Run AFTER all table creation migrations.
-- ============================================================

-- clients.created_by_patient
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by_patient boolean DEFAULT false;

-- clients.is_dependent
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_dependent boolean DEFAULT false;

-- clinical_evolutions.server_timestamp
ALTER TABLE public.clinical_evolutions ADD COLUMN server_timestamp TIMESTAMPTZ;

-- clinical_evolutions.signed_by_uf
ALTER TABLE public.clinical_evolutions ADD COLUMN signed_by_uf TEXT;

-- exam_results.exam_category
ALTER TABLE public.exam_results ADD COLUMN exam_category TEXT;

-- exam_results.performed_by
ALTER TABLE public.exam_results ADD COLUMN performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- exam_results.result_data
ALTER TABLE exam_results ADD COLUMN result_data JSONB;

-- goals.archived_at
ALTER TABLE public.goals ADD COLUMN archived_at TIMESTAMPTZ;

-- goals.custom_end
ALTER TABLE public.goals ADD COLUMN custom_end DATE;

-- goals.custom_start
ALTER TABLE public.goals ADD COLUMN custom_start DATE;

-- goals.header_priority
ALTER TABLE public.goals ADD COLUMN header_priority INT DEFAULT 0;

-- goals.parent_goal_id
ALTER TABLE public.goals ADD COLUMN parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

-- internal_messages.mentions
ALTER TABLE public.internal_messages ADD COLUMN mentions UUID[] DEFAULT '{}';

-- medical_certificates.content_hash
ALTER TABLE public.medical_certificates ADD COLUMN content_hash TEXT;

-- medical_certificates.server_timestamp
ALTER TABLE public.medical_certificates ADD COLUMN server_timestamp TIMESTAMPTZ;

-- medical_certificates.signed_by_crm
ALTER TABLE public.medical_certificates ADD COLUMN signed_by_crm TEXT;

-- medical_certificates.signed_by_name
ALTER TABLE public.medical_certificates ADD COLUMN signed_by_name TEXT;

-- medical_certificates.signed_by_specialty
ALTER TABLE public.medical_certificates ADD COLUMN signed_by_specialty TEXT;

-- medical_certificates.signed_by_uf
ALTER TABLE public.medical_certificates ADD COLUMN signed_by_uf TEXT;

-- medical_records.attendance_number
ALTER TABLE public.medical_records ADD COLUMN attendance_number BIGINT;

-- medical_records.attendance_type
ALTER TABLE public.medical_records ADD COLUMN attendance_type public.attendance_type DEFAULT 'consulta';

-- medical_records.server_timestamp
ALTER TABLE public.medical_records ADD COLUMN server_timestamp TIMESTAMPTZ;

-- medical_records.signed_by_uf
ALTER TABLE public.medical_records ADD COLUMN signed_by_uf TEXT;

-- prescriptions.content_hash
ALTER TABLE public.prescriptions ADD COLUMN content_hash TEXT;

-- prescriptions.digital_hash
ALTER TABLE public.prescriptions ADD COLUMN digital_hash TEXT;

-- prescriptions.server_timestamp
ALTER TABLE public.prescriptions ADD COLUMN server_timestamp TIMESTAMPTZ;

-- prescriptions.signed_by_crm
ALTER TABLE public.prescriptions ADD COLUMN signed_by_crm TEXT;

-- prescriptions.signed_by_name
ALTER TABLE public.prescriptions ADD COLUMN signed_by_name TEXT;

-- prescriptions.signed_by_uf
ALTER TABLE public.prescriptions ADD COLUMN signed_by_uf TEXT;

-- tenants.nfeio_active
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_active BOOLEAN DEFAULT FALSE;

-- tenants.nfeio_api_key
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_api_key TEXT;

-- tenants.nfeio_auto_emit
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_auto_emit BOOLEAN DEFAULT FALSE;

-- tenants.nfeio_certificate_expires
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_certificate_expires TIMESTAMPTZ;

-- tenants.nfeio_company_id
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_company_id TEXT;

-- tenants.nfeio_default_service_code
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_default_service_code TEXT DEFAULT '4.03';

