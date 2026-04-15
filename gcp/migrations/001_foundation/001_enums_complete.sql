-- ============================================================
-- GCP Cloud SQL Migration - 002_enums.sql
-- Execution Order: 002
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: All Enum Types
-- Total: 40 types + 13 ADD VALUE

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Source: 20260203000000_create_commissions.sql
DO $$ BEGIN
    CREATE TYPE public.commission_type AS ENUM ('percentage', 'fixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source: 20260203000000_create_commissions.sql
DO $$ BEGIN
    CREATE TYPE public.commission_status AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source: 20260214000000_create_goals.sql
DO $$ BEGIN
  CREATE TYPE public.goal_type AS ENUM ('revenue', 'services_count', 'product_quantity', 'product_revenue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260214000000_create_goals.sql
DO $$ BEGIN
  CREATE TYPE public.goal_period AS ENUM ('weekly', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260218200000_orders_checkout_v1.sql
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('draft','open','paid','cancelled','refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260218200000_orders_checkout_v1.sql
DO $$ BEGIN
  CREATE TYPE public.order_item_kind AS ENUM ('service','product');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260218200000_orders_checkout_v1.sql
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260218220000_cash_register_v1.sql
DO $$ BEGIN
  CREATE TYPE public.cash_session_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260218220000_cash_register_v1.sql
DO $$ BEGIN
  CREATE TYPE public.cash_movement_type AS ENUM ('reinforcement','withdrawal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260312010000_crm_packages_v1.sql
do $$
begin
  create type public.client_package_status as enum ('active', 'depleted', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- Source: 20260312010000_crm_packages_v1.sql
do $$
begin
  create type public.client_package_ledger_reason as enum ('purchase', 'consume', 'adjust', 'revert', 'cancel');
exception
  when duplicate_object then null;
end $$;

-- Source: 20260312020000_loyalty_cashback_v1.sql
do $$
begin
  create type public.cashback_ledger_reason as enum ('earn', 'redeem', 'adjust', 'revert');
exception
  when duplicate_object then null;
end $$;

-- Source: 20260312022000_campaigns_email_optout_v1.sql
do $$
begin
  create type public.campaign_status as enum ('draft', 'sent', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- Source: 20260312030000_purchases_suppliers_avg_cost_v1.sql
do $$
begin
  create type public.purchase_status as enum ('draft', 'received', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- Source: 20260325000001_odontograms_v1.sql
DO $$ BEGIN
    CREATE TYPE public.professional_type AS ENUM (
      'admin',
      'medico',
      'dentista',
      'enfermeiro',
      'tec_enfermagem',
      'fisioterapeuta',
      'nutricionista',
      'psicologo',
      'fonoaudiologo',
      'secretaria',
      'faturista',
      'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TYPE sngpc_transmissao_status AS ENUM (
  'pendente',      -- Aguardando envio
  'enviado',       -- Enviado, aguardando validação
  'validado',      -- Validado pela ANVISA
  'erro',          -- Erro no envio ou validação
  'rejeitado'      -- Rejeitado pela ANVISA
);

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TYPE sngpc_transmissao_tipo AS ENUM (
  'movimentacao',  -- Movimentações do período
  'inventario',    -- Inventário/Balanço
  'retificacao'    -- Retificação de envio anterior
);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TYPE report_field_type AS ENUM (
  'text', 'number', 'currency', 'date', 'datetime', 'boolean', 'percentage', 'duration'
);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TYPE report_aggregation AS ENUM (
  'none', 'count', 'sum', 'avg', 'min', 'max', 'count_distinct'
);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TYPE report_chart_type AS ENUM (
  'none', 'line', 'bar', 'pie', 'area', 'donut', 'stacked_bar'
);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TYPE report_schedule_frequency AS ENUM (
  'daily', 'weekly', 'biweekly', 'monthly'
);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TYPE report_category AS ENUM (
  'financeiro', 'atendimento', 'clinico', 'marketing', 'operacional', 'custom'
);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TYPE tsa_status AS ENUM (
  'pending',      -- Aguardando carimbo
  'stamped',      -- Carimbado com sucesso
  'error',        -- Erro no carimbo
  'expired'       -- Certificado expirado
);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TYPE tsa_document_type AS ENUM (
  'prontuario',
  'receituario',
  'atestado',
  'laudo',
  'termo_consentimento',
  'evolucao',
  'contrato',
  'outro'
);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TYPE tsa_provider AS ENUM (
  'certisign',
  'bry',
  'valid',
  'serpro',
  'custom'
);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE TYPE adverse_event_type AS ENUM (
  'QUEDA',
  'ERRO_MEDICACAO',
  'LESAO_PRESSAO',
  'INFECCAO',
  'IDENTIFICACAO_INCORRETA',
  'FALHA_COMUNICACAO',
  'FALHA_EQUIPAMENTO',
  'REACAO_ADVERSA',
  'EXTRAVIO_MATERIAL',
  'OUTRO'
);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE TYPE adverse_event_status AS ENUM (
  'NOTIFICADO',     -- Recém-reportado
  'EM_ANALISE',     -- Sob investigação
  'ACAO_CORRETIVA', -- Ações sendo implementadas
  'ENCERRADO',      -- Investigação concluída
  'REABERTO'        -- Reaberto para nova análise
);

-- Source: 20260327000000_commission_rules_v1.sql
DO $$ BEGIN
    CREATE TYPE public.commission_rule_type AS ENUM ('default', 'service', 'insurance', 'procedure', 'sale');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source: 20260327000000_commission_rules_v1.sql
DO $$ BEGIN
    CREATE TYPE public.commission_calculation_type AS ENUM ('percentage', 'fixed', 'tiered');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
DO $$ BEGIN
    CREATE TYPE public.payment_gateway_provider AS ENUM ('asaas', 'pagseguro', 'stone', 'stripe');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260329100000_rnds_integration_v1.sql
DO $$ BEGIN
  CREATE TYPE rnds_submission_status AS ENUM (
    'pending',
    'processing',
    'success',
    'error',
    'retry'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260329100000_rnds_integration_v1.sql
DO $$ BEGIN
  CREATE TYPE rnds_resource_type AS ENUM (
    'contato_assistencial',
    'resultado_exame',
    'imunizacao',
    'atestado_digital',
    'prescricao_digital'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260330100000_financial_refactor_v1.sql
DO $$ BEGIN
    CREATE TYPE public.receivable_status AS ENUM ('pending', 'partial', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source: 20260330100000_financial_refactor_v1.sql
DO $$ BEGIN
    CREATE TYPE public.payment_source AS ENUM ('particular', 'insurance', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Source: 20260330700000_profile_certificates_v1.sql
DO $$ BEGIN
  CREATE TYPE public.certificate_type AS ENUM (
    'A1',     -- Arquivo .pfx/.p12 (armazenado criptografado)
    'A3',     -- Token/Cartão (referência via WebPKI)
    'cloud'   -- Certificado em nuvem (BirdID, CertiSign, etc.)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260330800000_cfm_required_fields_v1.sql
DO $$ BEGIN
  CREATE TYPE public.attendance_type AS ENUM (
    'consulta',           -- Consulta inicial
    'retorno',            -- Retorno/Revisão
    'urgencia',           -- Urgência
    'emergencia',         -- Emergência
    'procedimento',       -- Procedimento ambulatorial
    'exame',              -- Realização de exame
    'teleconsulta',       -- Teleconsulta
    'domiciliar',         -- Atendimento domiciliar
    'preventivo',         -- Consulta preventiva
    'pre_operatorio',     -- Avaliação pré-operatória
    'pos_operatorio',     -- Acompanhamento pós-operatório
    'outro'               -- Outro tipo
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Source: 20260330900000_document_verification_v1.sql
DO $$ BEGIN
  CREATE TYPE public.verifiable_document_type AS ENUM (
    'medical_certificate',
    'prescription',
    'medical_record',
    'clinical_evolution',
    'exam_request',
    'medical_report'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ALTER TYPE ADD VALUE statements

-- Source: 20260215000000_goals_enhancements.sql
ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'clientes_novos';

-- Source: 20260215000000_goals_enhancements.sql
ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'ticket_medio';

-- Source: 20260215000000_goals_enhancements.sql
ALTER TYPE public.goal_period ADD VALUE IF NOT EXISTS 'quarterly';

-- Source: 20260312050000_campaigns_robust_v1.sql
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'sending';

-- Source: 20260327300000_referral_commission_v1.sql
ALTER TYPE public.commission_rule_type ADD VALUE IF NOT EXISTS 'referral';

-- Source: 20260328100000_fix_referral_report_types_v1.sql
ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'appointments_count';

-- Source: 20260328100000_fix_referral_report_types_v1.sql
ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'procedures_count';

-- Source: 20260328100000_fix_referral_report_types_v1.sql
ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'new_patients';

-- Source: 20260328100000_fix_referral_report_types_v1.sql
ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'patient_return_rate';

-- Source: 20260328100000_fix_referral_report_types_v1.sql
ALTER TYPE public.goal_type ADD VALUE IF NOT EXISTS 'ticket_medio';

-- Source: 20260328500000_auto_queue_on_checkin_v1.sql
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'arrived' AFTER 'confirmed';

-- Source: 20260401100000_consent_verification_extension.sql
ALTER TYPE public.verifiable_document_type ADD VALUE IF NOT EXISTS 'consent';

