-- ============================================================================
-- FASE 44: Migração de Nomenclatura — clients → patients
-- ============================================================================
-- Justificativa: O sistema usa "clients" (termo de salão/varejo) mas exibe
-- "Pacientes" na interface. Esta migration corrige a inconsistência.
-- ============================================================================

-- 1. Renomear tabela principal
ALTER TABLE IF EXISTS public.clients RENAME TO patients;

-- 2. Renomear colunas client_id → patient_id em todas as tabelas

-- appointments
ALTER TABLE IF EXISTS public.appointments 
  RENAME COLUMN client_id TO patient_id;

-- medical_records
ALTER TABLE IF EXISTS public.medical_records 
  RENAME COLUMN client_id TO patient_id;

-- triages (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'triages' AND column_name = 'client_id') THEN
    ALTER TABLE public.triages RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- triage_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'triage_records' AND column_name = 'client_id') THEN
    ALTER TABLE public.triage_records RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- prescriptions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescriptions' AND column_name = 'client_id') THEN
    ALTER TABLE public.prescriptions RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- medical_certificates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_certificates' AND column_name = 'client_id') THEN
    ALTER TABLE public.medical_certificates RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- exam_results
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_results' AND column_name = 'client_id') THEN
    ALTER TABLE public.exam_results RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- referrals
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'client_id') THEN
    ALTER TABLE public.referrals RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- clinical_evolutions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinical_evolutions' AND column_name = 'client_id') THEN
    ALTER TABLE public.clinical_evolutions RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- nursing_evolutions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nursing_evolutions' AND column_name = 'client_id') THEN
    ALTER TABLE public.nursing_evolutions RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_consents
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_consents' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_consents RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- consent_signing_tokens
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'consent_signing_tokens' AND column_name = 'client_id') THEN
    ALTER TABLE public.consent_signing_tokens RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- odontograms
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'odontograms' AND column_name = 'client_id') THEN
    ALTER TABLE public.odontograms RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- periograms
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'periograms' AND column_name = 'client_id') THEN
    ALTER TABLE public.periograms RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- dental_images
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dental_images' AND column_name = 'client_id') THEN
    ALTER TABLE public.dental_images RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- treatment_plans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'treatment_plans' AND column_name = 'client_id') THEN
    ALTER TABLE public.treatment_plans RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- bills_receivable
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_receivable' AND column_name = 'client_id') THEN
    ALTER TABLE public.bills_receivable RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- orders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'client_id') THEN
    ALTER TABLE public.orders RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- cashback_wallets
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashback_wallets' AND column_name = 'client_id') THEN
    ALTER TABLE public.cashback_wallets RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- cashback_ledger
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashback_ledger' AND column_name = 'client_id') THEN
    ALTER TABLE public.cashback_ledger RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- client_packages → patient_packages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_packages') THEN
    ALTER TABLE public.client_packages RENAME TO patient_packages;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_packages' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_packages RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- waitlist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist' AND column_name = 'client_id') THEN
    ALTER TABLE public.waitlist RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- return_reminders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_reminders' AND column_name = 'client_id') THEN
    ALTER TABLE public.return_reminders RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_calls
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_calls' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_calls RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- tiss_guias
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tiss_guias' AND column_name = 'client_id') THEN
    ALTER TABLE public.tiss_guias RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_portal_users
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_portal_users' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_portal_users RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_messages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_messages' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_messages RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_invoices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_invoices' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_invoices RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_health_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_health_records' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_health_records RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_dependents (parent_client_id, dependent_client_id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_dependents' AND column_name = 'parent_client_id') THEN
    ALTER TABLE public.patient_dependents RENAME COLUMN parent_client_id TO parent_patient_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_dependents' AND column_name = 'dependent_client_id') THEN
    ALTER TABLE public.patient_dependents RENAME COLUMN dependent_client_id TO dependent_patient_id;
  END IF;
END $$;

-- ona_adverse_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ona_adverse_events' AND column_name = 'client_id') THEN
    ALTER TABLE public.ona_adverse_events RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- retention_audit_log
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retention_audit_log' AND column_name = 'client_id') THEN
    ALTER TABLE public.retention_audit_log RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- nfse_emitidas
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nfse_emitidas' AND column_name = 'client_id') THEN
    ALTER TABLE public.nfse_emitidas RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- patient_security_certificates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_security_certificates' AND column_name = 'client_id') THEN
    ALTER TABLE public.patient_security_certificates RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- tsa_consent_records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tsa_consent_records' AND column_name = 'client_id') THEN
    ALTER TABLE public.tsa_consent_records RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- hl7_patient_mappings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hl7_patient_mappings' AND column_name = 'client_id') THEN
    ALTER TABLE public.hl7_patient_mappings RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- rnds_submissions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rnds_submissions' AND column_name = 'patient_id') THEN
    -- Já está correto, não precisa renomear
    NULL;
  END IF;
END $$;

-- financial_transactions (se tiver client_id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_transactions' AND column_name = 'client_id') THEN
    ALTER TABLE public.financial_transactions RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;

-- 3. Criar view de compatibilidade para código legado
CREATE OR REPLACE VIEW public.clients AS 
SELECT * FROM public.patients;

-- 4. Atualizar RPCs que usam client_id

-- Atualizar função upsert_client → upsert_patient
CREATE OR REPLACE FUNCTION public.upsert_patient(
  p_tenant_id UUID,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_cpf TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_marital_status TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_street_number TEXT DEFAULT NULL,
  p_complement TEXT DEFAULT NULL,
  p_neighborhood TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_allergies TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  -- Tentar encontrar paciente existente por CPF ou telefone
  IF p_cpf IS NOT NULL AND p_cpf <> '' THEN
    SELECT id INTO v_patient_id
    FROM public.patients
    WHERE tenant_id = p_tenant_id AND cpf = p_cpf
    LIMIT 1;
  END IF;

  IF v_patient_id IS NULL AND p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT id INTO v_patient_id
    FROM public.patients
    WHERE tenant_id = p_tenant_id AND phone = p_phone
    LIMIT 1;
  END IF;

  IF v_patient_id IS NOT NULL THEN
    -- Atualizar paciente existente
    UPDATE public.patients
    SET
      name = COALESCE(p_name, name),
      phone = COALESCE(p_phone, phone),
      email = COALESCE(p_email, email),
      notes = COALESCE(p_notes, notes),
      cpf = COALESCE(p_cpf, cpf),
      date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
      marital_status = COALESCE(p_marital_status, marital_status),
      zip_code = COALESCE(p_zip_code, zip_code),
      street = COALESCE(p_street, street),
      street_number = COALESCE(p_street_number, street_number),
      complement = COALESCE(p_complement, complement),
      neighborhood = COALESCE(p_neighborhood, neighborhood),
      city = COALESCE(p_city, city),
      state = COALESCE(p_state, state),
      allergies = COALESCE(p_allergies, allergies),
      updated_at = NOW()
    WHERE id = v_patient_id;
  ELSE
    -- Inserir novo paciente
    INSERT INTO public.patients (
      tenant_id, name, phone, email, notes, cpf,
      date_of_birth, marital_status, zip_code, street,
      street_number, complement, neighborhood, city, state, allergies
    )
    VALUES (
      p_tenant_id, p_name, p_phone, p_email, p_notes, p_cpf,
      p_date_of_birth, p_marital_status, p_zip_code, p_street,
      p_street_number, p_complement, p_neighborhood, p_city, p_state, p_allergies
    )
    RETURNING id INTO v_patient_id;
  END IF;

  RETURN v_patient_id;
END;
$$;

-- Manter alias para compatibilidade
CREATE OR REPLACE FUNCTION public.upsert_client(
  p_tenant_id UUID,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_cpf TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_marital_status TEXT DEFAULT NULL,
  p_zip_code TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_street_number TEXT DEFAULT NULL,
  p_complement TEXT DEFAULT NULL,
  p_neighborhood TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_allergies TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.upsert_patient(
    p_tenant_id, p_name, p_phone, p_email, p_notes, p_cpf,
    p_date_of_birth, p_marital_status, p_zip_code, p_street,
    p_street_number, p_complement, p_neighborhood, p_city, p_state, p_allergies
  );
END;
$$;

-- 5. Comentário para documentação
COMMENT ON TABLE public.patients IS 'Tabela principal de pacientes (renomeada de clients na Fase 44)';
COMMENT ON VIEW public.clients IS 'View de compatibilidade - usar patients diretamente';
