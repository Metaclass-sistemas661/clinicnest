-- ============================================================================
-- FASE 45: Migração de Nomenclatura — services → procedures
-- ============================================================================
-- Justificativa: O sistema usa "services" (termo de salão de beleza) mas o
-- termo correto em contexto médico é "procedimento" (TUSS, Tasy, MV).
-- ============================================================================

-- 1. Renomear tabela principal
ALTER TABLE IF EXISTS public.services RENAME TO procedures;

-- 2. Renomear colunas service_id → procedure_id em todas as tabelas

-- appointments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'service_id') THEN
    ALTER TABLE public.appointments RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- order_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'service_id') THEN
    ALTER TABLE public.order_items RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- commission_rules
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commission_rules' AND column_name = 'service_id') THEN
    ALTER TABLE public.commission_rules RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- tiss_guias
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tiss_guias' AND column_name = 'service_id') THEN
    ALTER TABLE public.tiss_guias RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- treatment_plan_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'treatment_plan_items' AND column_name = 'service_id') THEN
    ALTER TABLE public.treatment_plan_items RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- professional_services → professional_procedures
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professional_services') THEN
    ALTER TABLE public.professional_services RENAME TO professional_procedures;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'professional_procedures' AND column_name = 'service_id') THEN
    ALTER TABLE public.professional_procedures RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- automation_rules
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_rules' AND column_name = 'service_id') THEN
    ALTER TABLE public.automation_rules RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- waitlist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist' AND column_name = 'service_id') THEN
    ALTER TABLE public.waitlist RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- return_reminders
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_reminders' AND column_name = 'service_id') THEN
    ALTER TABLE public.return_reminders RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- patient_packages (antigo client_packages)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_packages' AND column_name = 'service_id') THEN
    ALTER TABLE public.patient_packages RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- client_packages (se ainda existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_packages' AND column_name = 'service_id') THEN
    ALTER TABLE public.client_packages RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- service_categories → procedure_categories
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_categories') THEN
    ALTER TABLE public.service_categories RENAME TO procedure_categories;
  END IF;
END $$;

-- financial_transactions (se tiver service_id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_transactions' AND column_name = 'service_id') THEN
    ALTER TABLE public.financial_transactions RENAME COLUMN service_id TO procedure_id;
  END IF;
END $$;

-- 3. Criar view de compatibilidade para código legado
CREATE OR REPLACE VIEW public.services AS 
SELECT * FROM public.procedures;

-- 4. Comentário para documentação
COMMENT ON TABLE public.procedures IS 'Tabela principal de procedimentos médicos (renomeada de services na Fase 45)';
COMMENT ON VIEW public.services IS 'View de compatibilidade - usar procedures diretamente';
