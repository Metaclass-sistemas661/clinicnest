-- ============================================================================
-- MIGRATION 017: Rename tables + columns (Fases 44+45 do Supabase)
-- Cópia EXATA dos renames originais do Supabase, sem alteração.
-- Ordem: 016 (ADD COLUMN) → 017 (RENAME) → views de compatibilidade
-- ============================================================================

BEGIN;

-- ========================
-- FASE 44: clients → patients
-- ========================

-- 1. Renomear tabela principal
ALTER TABLE IF EXISTS public.clients RENAME TO patients;

-- 2. Renomear colunas client_id → patient_id (APENAS as tabelas do rename original)

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointments' AND column_name='client_id') THEN
  ALTER TABLE public.appointments RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='medical_records' AND column_name='client_id') THEN
  ALTER TABLE public.medical_records RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='triage_records' AND column_name='client_id') THEN
  ALTER TABLE public.triage_records RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prescriptions' AND column_name='client_id') THEN
  ALTER TABLE public.prescriptions RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='medical_certificates' AND column_name='client_id') THEN
  ALTER TABLE public.medical_certificates RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='exam_results' AND column_name='client_id') THEN
  ALTER TABLE public.exam_results RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='referrals' AND column_name='client_id') THEN
  ALTER TABLE public.referrals RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clinical_evolutions' AND column_name='client_id') THEN
  ALTER TABLE public.clinical_evolutions RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nursing_evolutions' AND column_name='client_id') THEN
  ALTER TABLE public.nursing_evolutions RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_consents' AND column_name='client_id') THEN
  ALTER TABLE public.patient_consents RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='consent_signing_tokens' AND column_name='client_id') THEN
  ALTER TABLE public.consent_signing_tokens RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='odontograms' AND column_name='client_id') THEN
  ALTER TABLE public.odontograms RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='periograms' AND column_name='client_id') THEN
  ALTER TABLE public.periograms RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dental_images' AND column_name='client_id') THEN
  ALTER TABLE public.dental_images RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='treatment_plans' AND column_name='client_id') THEN
  ALTER TABLE public.treatment_plans RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bills_receivable' AND column_name='client_id') THEN
  ALTER TABLE public.bills_receivable RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='client_id') THEN
  ALTER TABLE public.orders RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cashback_wallets' AND column_name='client_id') THEN
  ALTER TABLE public.cashback_wallets RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cashback_ledger' AND column_name='client_id') THEN
  ALTER TABLE public.cashback_ledger RENAME COLUMN client_id TO patient_id;
END IF; END $$;

-- client_packages → patient_packages (table rename)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_packages') THEN
  ALTER TABLE public.client_packages RENAME TO patient_packages;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_packages' AND column_name='client_id') THEN
  ALTER TABLE public.patient_packages RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='waitlist' AND column_name='client_id') THEN
  ALTER TABLE public.waitlist RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='return_reminders' AND column_name='client_id') THEN
  ALTER TABLE public.return_reminders RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_calls' AND column_name='client_id') THEN
  ALTER TABLE public.patient_calls RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tiss_guias' AND column_name='client_id') THEN
  ALTER TABLE public.tiss_guias RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_portal_users' AND column_name='client_id') THEN
  ALTER TABLE public.patient_portal_users RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_messages' AND column_name='client_id') THEN
  ALTER TABLE public.patient_messages RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_invoices' AND column_name='client_id') THEN
  ALTER TABLE public.patient_invoices RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_health_records' AND column_name='client_id') THEN
  ALTER TABLE public.patient_health_records RENAME COLUMN client_id TO patient_id;
END IF; END $$;

-- patient_dependents (dual columns)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_dependents' AND column_name='parent_client_id') THEN
  ALTER TABLE public.patient_dependents RENAME COLUMN parent_client_id TO parent_patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_dependents' AND column_name='dependent_client_id') THEN
  ALTER TABLE public.patient_dependents RENAME COLUMN dependent_client_id TO dependent_patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ona_adverse_events' AND column_name='client_id') THEN
  ALTER TABLE public.ona_adverse_events RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='retention_audit_log' AND column_name='client_id') THEN
  ALTER TABLE public.retention_audit_log RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nfse_emitidas' AND column_name='client_id') THEN
  ALTER TABLE public.nfse_emitidas RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_security_certificates' AND column_name='client_id') THEN
  ALTER TABLE public.patient_security_certificates RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tsa_consent_records' AND column_name='client_id') THEN
  ALTER TABLE public.tsa_consent_records RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hl7_patient_mappings' AND column_name='client_id') THEN
  ALTER TABLE public.hl7_patient_mappings RENAME COLUMN client_id TO patient_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_transactions' AND column_name='client_id') THEN
  ALTER TABLE public.financial_transactions RENAME COLUMN client_id TO patient_id;
END IF; END $$;

-- 3. View de compatibilidade
CREATE OR REPLACE VIEW public.clients AS SELECT * FROM public.patients;


-- ========================
-- FASE 45: services → procedures
-- ========================

-- 1. Renomear tabela principal
ALTER TABLE IF EXISTS public.services RENAME TO procedures;

-- 2. Renomear colunas service_id → procedure_id (APENAS tabelas do rename original)

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='appointments' AND column_name='service_id') THEN
  ALTER TABLE public.appointments RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='service_id') THEN
  ALTER TABLE public.order_items RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commission_rules' AND column_name='service_id') THEN
  ALTER TABLE public.commission_rules RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tiss_guias' AND column_name='service_id') THEN
  ALTER TABLE public.tiss_guias RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='treatment_plan_items' AND column_name='service_id') THEN
  ALTER TABLE public.treatment_plan_items RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

-- professional_services → professional_procedures (table rename)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='professional_services') THEN
  ALTER TABLE public.professional_services RENAME TO professional_procedures;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='professional_procedures' AND column_name='service_id') THEN
  ALTER TABLE public.professional_procedures RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='automation_rules' AND column_name='service_id') THEN
  ALTER TABLE public.automation_rules RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='waitlist' AND column_name='service_id') THEN
  ALTER TABLE public.waitlist RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='return_reminders' AND column_name='service_id') THEN
  ALTER TABLE public.return_reminders RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patient_packages' AND column_name='service_id') THEN
  ALTER TABLE public.patient_packages RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='client_packages' AND column_name='service_id') THEN
  ALTER TABLE public.client_packages RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

-- service_categories → procedure_categories (table rename)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='service_categories') THEN
  ALTER TABLE public.service_categories RENAME TO procedure_categories;
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_transactions' AND column_name='service_id') THEN
  ALTER TABLE public.financial_transactions RENAME COLUMN service_id TO procedure_id;
END IF; END $$;

-- 3. Views de compatibilidade
CREATE OR REPLACE VIEW public.services AS SELECT * FROM public.procedures;

-- 4. Comentários
COMMENT ON TABLE public.patients IS 'Tabela de pacientes (renomeada de clients - Fase 44)';
COMMENT ON VIEW public.clients IS 'View de compatibilidade - usar patients diretamente';
COMMENT ON TABLE public.procedures IS 'Tabela de procedimentos (renomeada de services - Fase 45)';
COMMENT ON VIEW public.services IS 'View de compatibilidade - usar procedures diretamente';

COMMIT;
