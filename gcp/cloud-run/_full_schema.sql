-- ============================================
-- ClinicaFlow / ClinicNest — Complete Cloud SQL Schema
-- Generated: 2026-04-16T05:44:00.262Z
-- Database: clinicnest
-- ============================================

-- Table: accounts_receivable
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  amount NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  client_id UUID,
  installments INTEGER DEFAULT 1,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  professional_id UUID,
  PRIMARY KEY (id)
);

-- FK: accounts_receivable_patient_id_fkey
-- ALTER TABLE accounts_receivable ADD CONSTRAINT accounts_receivable_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: accounts_receivable_tenant_id_fkey
-- ALTER TABLE accounts_receivable ADD CONSTRAINT accounts_receivable_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: accounts_receivable_appointment_id_fkey
-- ALTER TABLE accounts_receivable ADD CONSTRAINT accounts_receivable_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: accounts_receivable_client_id_fkey
-- ALTER TABLE accounts_receivable ADD CONSTRAINT accounts_receivable_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: accounts_receivable_professional_id_fkey
-- ALTER TABLE accounts_receivable ADD CONSTRAINT accounts_receivable_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_accounts_receivable_tenant ON public.accounts_receivable USING btree (tenant_id);


-- Table: admin_audit_logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID NOT NULL,
  entity_id TEXT,
  entity_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- FK: admin_audit_logs_tenant_id_fkey
-- ALTER TABLE admin_audit_logs ADD CONSTRAINT admin_audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_admin_audit_logs_actor ON public.admin_audit_logs USING btree (actor_user_id, created_at DESC);

CREATE INDEX idx_admin_audit_logs_tenant ON public.admin_audit_logs USING btree (tenant_id);

CREATE INDEX idx_admin_audit_logs_tenant_created_at ON public.admin_audit_logs USING btree (tenant_id, created_at DESC);


-- Table: adverse_events
CREATE TABLE IF NOT EXISTS adverse_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  reported_by UUID,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  root_cause TEXT,
  corrective_actions TEXT,
  status TEXT DEFAULT 'open'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acoes_corretivas TEXT,
  acoes_preventivas TEXT,
  circunstancias TEXT,
  conclusao TEXT,
  data_evento TIMESTAMPTZ NOT NULL,
  data_notificacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_notificacao_anvisa TIMESTAMPTZ,
  fatores_contribuintes TEXT[],
  licoes_aprendidas TEXT,
  local_evento TEXT,
  notificado_por UUID,
  prazo_acoes DATE,
  professional_id UUID,
  protocolo_anvisa TEXT,
  responsavel_investigacao UUID,
  setor TEXT,
  testemunhas TEXT,
  tipo_outro TEXT,
  PRIMARY KEY (id)
);

-- FK: adverse_events_tenant_id_fkey
-- ALTER TABLE adverse_events ADD CONSTRAINT adverse_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: adverse_events_patient_id_fkey
-- ALTER TABLE adverse_events ADD CONSTRAINT adverse_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: adverse_events_notificado_por_fkey
-- ALTER TABLE adverse_events ADD CONSTRAINT adverse_events_notificado_por_fkey FOREIGN KEY (notificado_por) REFERENCES profiles(id);

-- FK: adverse_events_professional_id_fkey
-- ALTER TABLE adverse_events ADD CONSTRAINT adverse_events_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: adverse_events_responsavel_investigacao_fkey
-- ALTER TABLE adverse_events ADD CONSTRAINT adverse_events_responsavel_investigacao_fkey FOREIGN KEY (responsavel_investigacao) REFERENCES profiles(id);

CREATE INDEX idx_adverse_events_tenant ON public.adverse_events USING btree (tenant_id);


-- Table: adverse_events_attachments
CREATE TABLE IF NOT EXISTS adverse_events_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  adverse_event_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: adverse_events_attachments_adverse_event_id_fkey
-- ALTER TABLE adverse_events_attachments ADD CONSTRAINT adverse_events_attachments_adverse_event_id_fkey FOREIGN KEY (adverse_event_id) REFERENCES adverse_events(id);


-- Table: adverse_events_history
CREATE TABLE IF NOT EXISTS adverse_events_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  adverse_event_id UUID NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  old_status ADVERSE_EVENT_STATUS,
  new_status ADVERSE_EVENT_STATUS,
  comentario TEXT,
  dados_alterados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: adverse_events_history_adverse_event_id_fkey
-- ALTER TABLE adverse_events_history ADD CONSTRAINT adverse_events_history_adverse_event_id_fkey FOREIGN KEY (adverse_event_id) REFERENCES adverse_events(id);


-- Table: aesthetic_anamnesis
CREATE TABLE IF NOT EXISTS aesthetic_anamnesis (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  fitzpatrick TEXT DEFAULT ''::text,
  skin_type TEXT DEFAULT ''::text,
  allergies TEXT DEFAULT ''::text,
  isotretinoin BOOLEAN DEFAULT false,
  pregnant BOOLEAN DEFAULT false,
  previous_procedures TEXT DEFAULT ''::text,
  expectations TEXT DEFAULT ''::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: aesthetic_anamnesis_tenant_id_fkey
-- ALTER TABLE aesthetic_anamnesis ADD CONSTRAINT aesthetic_anamnesis_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: aesthetic_anamnesis_patient_id_fkey
-- ALTER TABLE aesthetic_anamnesis ADD CONSTRAINT aesthetic_anamnesis_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE UNIQUE INDEX aesthetic_anamnesis_tenant_id_patient_id_key ON public.aesthetic_anamnesis USING btree (tenant_id, patient_id);

CREATE INDEX idx_aesthetic_anamnesis_patient ON public.aesthetic_anamnesis USING btree (tenant_id, patient_id);


-- Table: aesthetic_protocols
CREATE TABLE IF NOT EXISTS aesthetic_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  name TEXT NOT NULL,
  procedure TEXT NOT NULL DEFAULT ''::text,
  total_sessions INTEGER NOT NULL DEFAULT 4,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 30,
  next_session_date TIMESTAMPTZ,
  notes TEXT DEFAULT ''::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: aesthetic_protocols_tenant_id_fkey
-- ALTER TABLE aesthetic_protocols ADD CONSTRAINT aesthetic_protocols_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: aesthetic_protocols_patient_id_fkey
-- ALTER TABLE aesthetic_protocols ADD CONSTRAINT aesthetic_protocols_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_aesthetic_protocols_patient ON public.aesthetic_protocols USING btree (tenant_id, patient_id);


-- Table: ai_conversation_messages
CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tokens_used INTEGER DEFAULT 0,
  tool_input JSONB,
  tool_name TEXT,
  PRIMARY KEY (id)
);

-- FK: ai_conversation_messages_conversation_id_fkey
-- ALTER TABLE ai_conversation_messages ADD CONSTRAINT ai_conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id);

-- FK: ai_conversation_messages_tenant_id_fkey
-- ALTER TABLE ai_conversation_messages ADD CONSTRAINT ai_conversation_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_ai_messages_conversation ON public.ai_conversation_messages USING btree (conversation_id);


-- Table: ai_conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT,
  model TEXT DEFAULT 'gemini-2.0-flash'::text,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  participant_type TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- FK: ai_conversations_tenant_id_fkey
-- ALTER TABLE ai_conversations ADD CONSTRAINT ai_conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_ai_conversations_tenant ON public.ai_conversations USING btree (tenant_id);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations USING btree (user_id);


-- Table: ai_performance_metrics
CREATE TABLE IF NOT EXISTS ai_performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT,
  success BOOLEAN DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completion_tokens INTEGER DEFAULT 0,
  confidence_score NUMERIC(5,2),
  interaction_id UUID NOT NULL DEFAULT gen_random_uuid(),
  model_id TEXT,
  module_name TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  request_payload JSONB DEFAULT '{}'::jsonb,
  response_summary TEXT,
  user_feedback TEXT,
  user_id UUID,
  PRIMARY KEY (id)
);

-- FK: ai_performance_metrics_tenant_id_fkey
-- ALTER TABLE ai_performance_metrics ADD CONSTRAINT ai_performance_metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: ai_performance_metrics_user_id_fkey
-- ALTER TABLE ai_performance_metrics ADD CONSTRAINT ai_performance_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);

CREATE INDEX idx_ai_metrics_tenant ON public.ai_performance_metrics USING btree (tenant_id);


-- Table: ai_usage_log
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  feature TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- FK: ai_usage_log_tenant_id_fkey
-- ALTER TABLE ai_usage_log ADD CONSTRAINT ai_usage_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: appointment_cashback_earnings
CREATE TABLE IF NOT EXISTS appointment_cashback_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  percentage NUMERIC(5,2),
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID NOT NULL,
  earned_amount NUMERIC NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: appointment_cashback_earnings_tenant_id_fkey
-- ALTER TABLE appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: appointment_cashback_earnings_appointment_id_fkey
-- ALTER TABLE appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: appointment_cashback_earnings_patient_id_fkey
-- ALTER TABLE appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: appointment_cashback_earnings_client_id_fkey
-- ALTER TABLE appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

CREATE INDEX idx_cashback_earnings_appointment ON public.appointment_cashback_earnings USING btree (appointment_id);


-- Table: appointment_completion_summaries
CREATE TABLE IF NOT EXISTS appointment_completion_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  professional_name TEXT,
  service_name TEXT,
  service_profit NUMERIC(10,2) DEFAULT 0,
  product_sales JSONB DEFAULT '[]'::jsonb,
  product_profit_total NUMERIC(10,2) DEFAULT 0,
  total_profit NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: appointment_completion_summaries_tenant_id_fkey
-- ALTER TABLE appointment_completion_summaries ADD CONSTRAINT appointment_completion_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: appointment_completion_summaries_appointment_id_fkey
-- ALTER TABLE appointment_completion_summaries ADD CONSTRAINT appointment_completion_summaries_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE UNIQUE INDEX appointment_completion_summaries_appointment_id_unique ON public.appointment_completion_summaries USING btree (appointment_id) WHERE (appointment_id IS NOT NULL);

CREATE INDEX idx_appointment_completion_summaries_created ON public.appointment_completion_summaries USING btree (created_at);

CREATE INDEX idx_appointment_completion_summaries_tenant ON public.appointment_completion_summaries USING btree (tenant_id);


-- Table: appointment_package_consumptions
CREATE TABLE IF NOT EXISTS appointment_package_consumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  package_id UUID NOT NULL,
  sessions_used INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: appointment_package_consumptions_tenant_id_fkey
-- ALTER TABLE appointment_package_consumptions ADD CONSTRAINT appointment_package_consumptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: appointment_package_consumptions_appointment_id_fkey
-- ALTER TABLE appointment_package_consumptions ADD CONSTRAINT appointment_package_consumptions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: appointment_package_consumptions_package_id_fkey
-- ALTER TABLE appointment_package_consumptions ADD CONSTRAINT appointment_package_consumptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES client_packages(id);


-- Table: appointment_ratings
CREATE TABLE IF NOT EXISTS appointment_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: appointment_ratings_tenant_id_fkey
-- ALTER TABLE appointment_ratings ADD CONSTRAINT appointment_ratings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: appointment_ratings_appointment_id_fkey
-- ALTER TABLE appointment_ratings ADD CONSTRAINT appointment_ratings_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE UNIQUE INDEX appointment_ratings_appointment_id_key ON public.appointment_ratings USING btree (appointment_id);


-- Table: appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  procedure_id UUID,
  professional_id UUID,
  specialty_id UUID,
  insurance_plan_id UUID,
  room_id UUID,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status APPOINTMENT_STATUS NOT NULL DEFAULT 'pending'::appointment_status,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(10,2),
  consultation_type TEXT,
  insurance_authorization TEXT,
  cid_code TEXT,
  notes TEXT,
  telemedicine BOOLEAN DEFAULT false,
  telemedicine_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  booked_by_id UUID,
  client_id UUID,
  confirmation_sent_4h BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  created_via TEXT NOT NULL DEFAULT 'internal'::text,
  service_id UUID,
  source TEXT,
  telemedicine_token UUID,
  unit_id UUID,
  PRIMARY KEY (id)
);

-- FK: appointments_tenant_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: appointments_patient_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: appointments_procedure_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES procedures(id);

-- FK: appointments_professional_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: appointments_specialty_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES specialties(id);

-- FK: appointments_insurance_plan_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_insurance_plan_id_fkey FOREIGN KEY (insurance_plan_id) REFERENCES insurance_plans(id);

-- FK: appointments_room_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id);

-- FK: appointments_booked_by_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_booked_by_id_fkey FOREIGN KEY (booked_by_id) REFERENCES profiles(user_id);

-- FK: appointments_client_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: appointments_service_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES procedures(id);

-- FK: appointments_unit_id_fkey
-- ALTER TABLE appointments ADD CONSTRAINT appointments_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES clinic_units(id);

CREATE UNIQUE INDEX appointments_telemedicine_token_key ON public.appointments USING btree (telemedicine_token);

CREATE INDEX idx_appointments_created_via ON public.appointments USING btree (created_via);

CREATE INDEX idx_appointments_patient_id ON public.appointments USING btree (patient_id);

CREATE INDEX idx_appointments_professional_id ON public.appointments USING btree (professional_id);

CREATE INDEX idx_appointments_scheduled_at ON public.appointments USING btree (scheduled_at);

CREATE INDEX idx_appointments_source ON public.appointments USING btree (tenant_id, source) WHERE (source = 'online'::text);

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);

CREATE INDEX idx_appointments_tenant_id ON public.appointments USING btree (tenant_id);

CREATE INDEX idx_appointments_tenant_professional_scheduled_at ON public.appointments USING btree (tenant_id, professional_id, scheduled_at);

CREATE INDEX idx_appointments_tenant_professional_scheduled_at_not_cancelled ON public.appointments USING btree (tenant_id, professional_id, scheduled_at) WHERE (status <> 'cancelled'::appointment_status);

CREATE INDEX idx_appointments_tenant_scheduled_at ON public.appointments USING btree (tenant_id, scheduled_at);


-- Table: archived_clinical_data
CREATE TABLE IF NOT EXISTS archived_clinical_data (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_cpf TEXT,
  client_cns TEXT,
  client_birth_date DATE,
  medical_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  prescriptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  triages JSONB NOT NULL DEFAULT '[]'::jsonb,
  evolutions JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_appointment_date DATE NOT NULL,
  retention_expired_at DATE NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_by UUID,
  export_pdf_url TEXT,
  export_xml_url TEXT,
  export_generated_at TIMESTAMPTZ,
  data_hash TEXT NOT NULL,
  can_be_deleted_after DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: archived_clinical_data_tenant_id_fkey
-- ALTER TABLE archived_clinical_data ADD CONSTRAINT archived_clinical_data_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: asaas_checkout_sessions
CREATE TABLE IF NOT EXISTS asaas_checkout_sessions (
  checkout_session_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (checkout_session_id)
);

-- FK: asaas_checkout_sessions_tenant_id_fkey
-- ALTER TABLE asaas_checkout_sessions ADD CONSTRAINT asaas_checkout_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX asaas_checkout_sessions_tenant_id_idx ON public.asaas_checkout_sessions USING btree (tenant_id);


-- Table: asaas_webhook_alerts
CREATE TABLE IF NOT EXISTS asaas_webhook_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id UUID,
  event_type TEXT,
  reason TEXT NOT NULL,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  checkout_session_id TEXT,
  payload JSONB,
  PRIMARY KEY (id)
);

CREATE INDEX asaas_webhook_alerts_created_at_idx ON public.asaas_webhook_alerts USING btree (created_at);

CREATE INDEX asaas_webhook_alerts_event_type_idx ON public.asaas_webhook_alerts USING btree (event_type);


-- Table: asaas_webhook_events
CREATE TABLE IF NOT EXISTS asaas_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  event_key TEXT NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'received'::text,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX asaas_webhook_events_event_key_key ON public.asaas_webhook_events USING btree (event_key);

CREATE INDEX asaas_webhook_events_received_at_idx ON public.asaas_webhook_events USING btree (received_at DESC);

CREATE INDEX asaas_webhook_events_status_idx ON public.asaas_webhook_events USING btree (status);

CREATE INDEX idx_asaas_events_type ON public.asaas_webhook_events USING btree (event_type);


-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_role TEXT,
  actor_user_id UUID,
  entity_id TEXT,
  entity_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- FK: audit_logs_tenant_id_fkey
-- ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id, created_at DESC);

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);

CREATE INDEX idx_audit_logs_tenant ON public.audit_logs USING btree (tenant_id);

CREATE INDEX idx_audit_logs_tenant_action_created_at ON public.audit_logs USING btree (tenant_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_tenant_created_at ON public.audit_logs USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_audit_logs_tenant_entity_created_at ON public.audit_logs USING btree (tenant_id, entity_type, created_at DESC);

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


-- Table: audit_policies_permissive
CREATE TABLE IF NOT EXISTS audit_policies_permissive (
  schema_name NAME,
  table_name NAME,
  policy_name NAME,
  command TEXT,
  using_expression TEXT,
  with_check_expression TEXT
);


-- Table: audit_public_tables_missing_tenant_id
CREATE TABLE IF NOT EXISTS audit_public_tables_missing_tenant_id (
  schema_name NAME,
  table_name NAME
);


-- Table: audit_rls_tables_without_policies
CREATE TABLE IF NOT EXISTS audit_rls_tables_without_policies (
  schema_name NAME,
  table_name NAME
);


-- Table: audit_tables_without_rls
CREATE TABLE IF NOT EXISTS audit_tables_without_rls (
  schema_name NAME,
  table_name NAME,
  rls_enabled BOOLEAN,
  rls_forced BOOLEAN
);


-- Table: automation_dispatch_logs
CREATE TABLE IF NOT EXISTS automation_dispatch_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  status TEXT DEFAULT 'sent'::text,
  target TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  dispatch_period TEXT NOT NULL DEFAULT 'once'::text,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- FK: automation_dispatch_logs_automation_id_fkey
-- ALTER TABLE automation_dispatch_logs ADD CONSTRAINT automation_dispatch_logs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id);

-- FK: automation_dispatch_logs_tenant_id_fkey
-- ALTER TABLE automation_dispatch_logs ADD CONSTRAINT automation_dispatch_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_automation_dispatch_tenant_created ON public.automation_dispatch_logs USING btree (tenant_id, created_at DESC);

CREATE UNIQUE INDEX uq_automation_dispatch_v2 ON public.automation_dispatch_logs USING btree (automation_id, entity_type, entity_id, dispatch_period);


-- Table: automations
CREATE TABLE IF NOT EXISTS automations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB,
  action_type TEXT NOT NULL,
  action_config JSONB,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL,
  message_template TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- FK: automations_tenant_id_fkey
-- ALTER TABLE automations ADD CONSTRAINT automations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_automations_tenant ON public.automations USING btree (tenant_id);

CREATE INDEX idx_automations_tenant_active ON public.automations USING btree (tenant_id, is_active);


-- Table: backup_logs
CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  backup_id TEXT NOT NULL,
  backup_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'::text,
  size_bytes BIGINT,
  tables_count INTEGER,
  records_count BIGINT,
  duration_seconds INTEGER,
  checksum_algorithm TEXT DEFAULT 'SHA-256'::text,
  checksum_value TEXT,
  verification_checksum TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  storage_location TEXT,
  storage_provider TEXT,
  retention_days INTEGER DEFAULT 365,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  backup_name VARCHAR(200) NOT NULL,
  compressed_size_bytes BIGINT,
  deleted_at TIMESTAMPTZ,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256'::character varying,
  is_deleted BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  restore_test_success BOOLEAN,
  storage_path TEXT,
  storage_region VARCHAR(50),
  verification_hash TEXT,
  PRIMARY KEY (id)
);

-- FK: backup_logs_tenant_id_fkey
-- ALTER TABLE backup_logs ADD CONSTRAINT backup_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: backup_retention_policies
CREATE TABLE IF NOT EXISTS backup_retention_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  backup_type TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 365,
  min_copies INTEGER DEFAULT 3,
  schedule_cron TEXT,
  enabled BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  notify_on_success BOOLEAN DEFAULT false,
  notification_emails TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: backup_retention_policies_tenant_id_fkey
-- ALTER TABLE backup_retention_policies ADD CONSTRAINT backup_retention_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX backup_retention_policies_tenant_id_name_key ON public.backup_retention_policies USING btree (tenant_id, name);


-- Table: backup_verifications
CREATE TABLE IF NOT EXISTS backup_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  backup_log_id UUID NOT NULL,
  verification_type TEXT NOT NULL,
  status TEXT NOT NULL,
  checksum_match BOOLEAN,
  tables_verified INTEGER,
  records_verified BIGINT,
  errors_found INTEGER DEFAULT 0,
  warnings_found INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: backup_verifications_tenant_id_fkey
-- ALTER TABLE backup_verifications ADD CONSTRAINT backup_verifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: backup_verifications_backup_log_id_fkey
-- ALTER TABLE backup_verifications ADD CONSTRAINT backup_verifications_backup_log_id_fkey FOREIGN KEY (backup_log_id) REFERENCES backup_logs(id);


-- Table: bills_payable
CREATE TABLE IF NOT EXISTS bills_payable (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at DATE,
  status TEXT DEFAULT 'pending'::text,
  category TEXT,
  supplier_id UUID,
  cost_center_id UUID,
  recurrence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  paid_amount NUMERIC(12,2),
  payment_method TEXT,
  recurrence_type TEXT,
  PRIMARY KEY (id)
);

-- FK: bills_payable_tenant_id_fkey
-- ALTER TABLE bills_payable ADD CONSTRAINT bills_payable_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: bills_payable_cost_center_id_fkey
-- ALTER TABLE bills_payable ADD CONSTRAINT bills_payable_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id);

-- FK: bills_payable_created_by_fkey
-- ALTER TABLE bills_payable ADD CONSTRAINT bills_payable_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

CREATE INDEX idx_bills_payable_tenant ON public.bills_payable USING btree (tenant_id);


-- Table: bills_receivable
CREATE TABLE IF NOT EXISTS bills_receivable (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  received_at DATE,
  status TEXT DEFAULT 'pending'::text,
  patient_id UUID,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID,
  created_by UUID,
  notes TEXT,
  payment_method TEXT,
  received_amount NUMERIC(12,2),
  PRIMARY KEY (id)
);

-- FK: bills_receivable_tenant_id_fkey
-- ALTER TABLE bills_receivable ADD CONSTRAINT bills_receivable_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: bills_receivable_patient_id_fkey
-- ALTER TABLE bills_receivable ADD CONSTRAINT bills_receivable_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: bills_receivable_client_id_fkey
-- ALTER TABLE bills_receivable ADD CONSTRAINT bills_receivable_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: bills_receivable_created_by_fkey
-- ALTER TABLE bills_receivable ADD CONSTRAINT bills_receivable_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

CREATE INDEX idx_bills_receivable_tenant ON public.bills_receivable USING btree (tenant_id);


-- Table: campaign_deliveries
CREATE TABLE IF NOT EXISTS campaign_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  email TEXT,
  status TEXT DEFAULT 'sent'::text,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID NOT NULL,
  error TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  to_email TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- FK: campaign_deliveries_campaign_id_fkey
-- ALTER TABLE campaign_deliveries ADD CONSTRAINT campaign_deliveries_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id);

-- FK: campaign_deliveries_tenant_id_fkey
-- ALTER TABLE campaign_deliveries ADD CONSTRAINT campaign_deliveries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: campaign_deliveries_patient_id_fkey
-- ALTER TABLE campaign_deliveries ADD CONSTRAINT campaign_deliveries_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: campaign_deliveries_client_id_fkey
-- ALTER TABLE campaign_deliveries ADD CONSTRAINT campaign_deliveries_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

CREATE INDEX idx_campaign_deliveries_campaign ON public.campaign_deliveries USING btree (campaign_id, created_at DESC);

CREATE INDEX idx_campaign_deliveries_campaign_status ON public.campaign_deliveries USING btree (campaign_id, status, created_at DESC);


-- Table: campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  html TEXT,
  preheader TEXT,
  banner_url TEXT,
  status TEXT DEFAULT 'draft'::text,
  sent_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  PRIMARY KEY (id)
);

-- FK: campaigns_tenant_id_fkey
-- ALTER TABLE campaigns ADD CONSTRAINT campaigns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_campaigns_tenant ON public.campaigns USING btree (tenant_id);


-- Table: cash_movements
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  PRIMARY KEY (id)
);

-- FK: cash_movements_tenant_id_fkey
-- ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: cash_movements_session_id_fkey
-- ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_session_id_fkey FOREIGN KEY (session_id) REFERENCES cash_sessions(id);

CREATE INDEX idx_cash_movements_session ON public.cash_movements USING btree (session_id, created_at DESC);

CREATE INDEX idx_cash_movements_tenant ON public.cash_movements USING btree (tenant_id, created_at DESC);


-- Table: cash_sessions
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  opened_by UUID,
  closed_by UUID,
  opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(10,2),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  closing_balance_expected NUMERIC(12,2),
  closing_balance_reported NUMERIC(12,2),
  closing_difference NUMERIC(12,2),
  closing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_notes TEXT,
  status CASH_SESSION_STATUS NOT NULL DEFAULT 'open'::cash_session_status,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: cash_sessions_tenant_id_fkey
-- ALTER TABLE cash_sessions ADD CONSTRAINT cash_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: cash_sessions_opened_by_fkey
-- ALTER TABLE cash_sessions ADD CONSTRAINT cash_sessions_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES profiles(id);

-- FK: cash_sessions_closed_by_fkey
-- ALTER TABLE cash_sessions ADD CONSTRAINT cash_sessions_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES profiles(id);

CREATE INDEX idx_cash_sessions_tenant_created ON public.cash_sessions USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_cash_sessions_tenant_id ON public.cash_sessions USING btree (tenant_id);

CREATE UNIQUE INDEX ux_cash_sessions_open_per_tenant ON public.cash_sessions USING btree (tenant_id) WHERE (status = 'open'::cash_session_status);


-- Table: cashback_ledger
CREATE TABLE IF NOT EXISTS cashback_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  appointment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,
  client_id UUID NOT NULL,
  delta_amount NUMERIC NOT NULL,
  notes TEXT,
  order_id UUID,
  reason CASHBACK_LEDGER_REASON NOT NULL,
  PRIMARY KEY (id)
);

-- FK: cashback_ledger_wallet_id_fkey
-- ALTER TABLE cashback_ledger ADD CONSTRAINT cashback_ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES cashback_wallets(id);

-- FK: cashback_ledger_tenant_id_fkey
-- ALTER TABLE cashback_ledger ADD CONSTRAINT cashback_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: cashback_ledger_appointment_id_fkey
-- ALTER TABLE cashback_ledger ADD CONSTRAINT cashback_ledger_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: cashback_ledger_client_id_fkey
-- ALTER TABLE cashback_ledger ADD CONSTRAINT cashback_ledger_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: cashback_ledger_order_id_fkey
-- ALTER TABLE cashback_ledger ADD CONSTRAINT cashback_ledger_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);

CREATE INDEX idx_cashback_ledger_client ON public.cashback_ledger USING btree (tenant_id, client_id, created_at DESC);


-- Table: cashback_wallets
CREATE TABLE IF NOT EXISTS cashback_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID NOT NULL,
  PRIMARY KEY (id)
);

-- FK: cashback_wallets_tenant_id_fkey
-- ALTER TABLE cashback_wallets ADD CONSTRAINT cashback_wallets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: cashback_wallets_patient_id_fkey
-- ALTER TABLE cashback_wallets ADD CONSTRAINT cashback_wallets_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: cashback_wallets_client_id_fkey
-- ALTER TABLE cashback_wallets ADD CONSTRAINT cashback_wallets_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

CREATE UNIQUE INDEX cashback_wallets_patient_id_key ON public.cashback_wallets USING btree (patient_id);

CREATE INDEX idx_cashback_wallets_patient ON public.cashback_wallets USING btree (patient_id);


-- Table: chat_channel_members
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  profile_id UUID NOT NULL,
  PRIMARY KEY (id)
);

-- FK: chat_channel_members_channel_id_fkey
-- ALTER TABLE chat_channel_members ADD CONSTRAINT chat_channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_channels(id);

-- FK: chat_channel_members_tenant_id_fkey
-- ALTER TABLE chat_channel_members ADD CONSTRAINT chat_channel_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: chat_channel_members_profile_id_fkey
-- ALTER TABLE chat_channel_members ADD CONSTRAINT chat_channel_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id);


-- Table: chat_channels
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_default BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: chat_channels_tenant_id_fkey
-- ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: chat_read_status
CREATE TABLE IF NOT EXISTS chat_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  channel TEXT NOT NULL,
  channel_id UUID,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_message_id UUID,
  PRIMARY KEY (id)
);

-- FK: chat_read_status_profile_id_fkey
-- ALTER TABLE chat_read_status ADD CONSTRAINT chat_read_status_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id);

-- FK: chat_read_status_channel_id_fkey
-- ALTER TABLE chat_read_status ADD CONSTRAINT chat_read_status_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_channels(id);

-- FK: chat_read_status_last_read_message_id_fkey
-- ALTER TABLE chat_read_status ADD CONSTRAINT chat_read_status_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES internal_messages(id);

CREATE UNIQUE INDEX chat_read_status_profile_id_channel_id_key ON public.chat_read_status USING btree (profile_id, channel_id);

CREATE UNIQUE INDEX chat_read_status_profile_id_channel_key ON public.chat_read_status USING btree (profile_id, channel);


-- Table: chatbot_conversations
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  phone TEXT NOT NULL,
  patient_id UUID,
  state TEXT DEFAULT 'IDLE'::text,
  context JSONB DEFAULT '{}'::jsonb,
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: chatbot_conversations_tenant_id_fkey
-- ALTER TABLE chatbot_conversations ADD CONSTRAINT chatbot_conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: chatbot_conversations_patient_id_fkey
-- ALTER TABLE chatbot_conversations ADD CONSTRAINT chatbot_conversations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: chatbot_conversations_client_id_fkey
-- ALTER TABLE chatbot_conversations ADD CONSTRAINT chatbot_conversations_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

CREATE INDEX idx_chatbot_conversations_phone ON public.chatbot_conversations USING btree (phone);

CREATE INDEX idx_chatbot_conversations_tenant ON public.chatbot_conversations USING btree (tenant_id);


-- Table: chatbot_messages
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_type TEXT NOT NULL DEFAULT 'text'::text,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

-- FK: chatbot_messages_conversation_id_fkey
-- ALTER TABLE chatbot_messages ADD CONSTRAINT chatbot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id);

-- FK: chatbot_messages_tenant_id_fkey
-- ALTER TABLE chatbot_messages ADD CONSTRAINT chatbot_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: chatbot_settings
CREATE TABLE IF NOT EXISTS chatbot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  greeting_message TEXT,
  business_hours JSONB,
  auto_booking BOOLEAN DEFAULT false,
  ai_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_confirm_booking BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  max_future_days INTEGER NOT NULL DEFAULT 30,
  menu_message TEXT NOT NULL DEFAULT 'Escolha uma opção:'::text,
  business_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}'::integer[],
  outside_hours_message TEXT NOT NULL DEFAULT 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que retornaremos assim que possível.'::text,
  business_hours_end TIME NOT NULL DEFAULT '18:00:00'::time without time zone,
  business_hours_start TIME NOT NULL DEFAULT '08:00:00'::time without time zone,
  welcome_message TEXT NOT NULL DEFAULT 'Olá! Bem-vindo(a) à nossa clínica. Como posso ajudá-lo(a)?'::text,
  PRIMARY KEY (id)
);

-- FK: chatbot_settings_tenant_id_fkey
-- ALTER TABLE chatbot_settings ADD CONSTRAINT chatbot_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX chatbot_settings_tenant_id_key ON public.chatbot_settings USING btree (tenant_id);


-- Table: client_marketing_preferences
CREATE TABLE IF NOT EXISTS client_marketing_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  email_opt_in BOOLEAN DEFAULT true,
  sms_opt_in BOOLEAN DEFAULT true,
  whatsapp_opt_in BOOLEAN DEFAULT true,
  push_opt_in BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: client_marketing_preferences_tenant_id_fkey
-- ALTER TABLE client_marketing_preferences ADD CONSTRAINT client_marketing_preferences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: client_marketing_preferences_patient_id_fkey
-- ALTER TABLE client_marketing_preferences ADD CONSTRAINT client_marketing_preferences_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE UNIQUE INDEX client_marketing_preferences_patient_id_key ON public.client_marketing_preferences USING btree (patient_id);

CREATE INDEX idx_client_marketing_prefs_patient ON public.client_marketing_preferences USING btree (patient_id);


-- Table: client_package_ledger
CREATE TABLE IF NOT EXISTS client_package_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  action TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: client_package_ledger_package_id_fkey
-- ALTER TABLE client_package_ledger ADD CONSTRAINT client_package_ledger_package_id_fkey FOREIGN KEY (package_id) REFERENCES patient_packages(id);

-- FK: client_package_ledger_tenant_id_fkey
-- ALTER TABLE client_package_ledger ADD CONSTRAINT client_package_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: client_package_ledger_appointment_id_fkey
-- ALTER TABLE client_package_ledger ADD CONSTRAINT client_package_ledger_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE INDEX idx_client_package_ledger_pkg ON public.client_package_ledger USING btree (package_id, created_at DESC);


-- Table: client_packages
CREATE TABLE IF NOT EXISTS client_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  used_sessions INTEGER DEFAULT 0,
  price NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'active'::text,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: client_packages_tenant_id_fkey1
-- ALTER TABLE client_packages ADD CONSTRAINT client_packages_tenant_id_fkey1 FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: client_packages_patient_id_fkey1
-- ALTER TABLE client_packages ADD CONSTRAINT client_packages_patient_id_fkey1 FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE UNIQUE INDEX client_packages_pkey1 ON public.client_packages USING btree (id);


-- Table: clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID,
  tenant_id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  blood_type TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  marketing_opt_out BOOLEAN,
  photo_url TEXT,
  access_code TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);


-- Table: clinic_rooms
CREATE TABLE IF NOT EXISTS clinic_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  unit_id UUID,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'consultation'::text,
  capacity INTEGER NOT NULL DEFAULT 1,
  floor TEXT,
  equipment TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: clinic_rooms_tenant_id_fkey
-- ALTER TABLE clinic_rooms ADD CONSTRAINT clinic_rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: clinic_rooms_unit_id_fkey
-- ALTER TABLE clinic_rooms ADD CONSTRAINT clinic_rooms_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES clinic_units(id);


-- Table: clinic_units
CREATE TABLE IF NOT EXISTS clinic_units (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state BPCHAR,
  address_zip TEXT,
  cnes_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: clinic_units_tenant_id_fkey
-- ALTER TABLE clinic_units ADD CONSTRAINT clinic_units_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: clinical_evolutions
CREATE TABLE IF NOT EXISTS clinical_evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  appointment_id UUID,
  medical_record_id UUID,
  evolution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  evolution_type TEXT NOT NULL DEFAULT 'medica'::text,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  cid_code TEXT,
  vital_signs JSONB DEFAULT '{}'::jsonb,
  digital_hash TEXT,
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signed_by_crm TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_timestamp TIMESTAMPTZ,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

-- FK: clinical_evolutions_tenant_id_fkey
-- ALTER TABLE clinical_evolutions ADD CONSTRAINT clinical_evolutions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: clinical_evolutions_client_id_fkey
-- ALTER TABLE clinical_evolutions ADD CONSTRAINT clinical_evolutions_client_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: clinical_evolutions_professional_id_fkey
-- ALTER TABLE clinical_evolutions ADD CONSTRAINT clinical_evolutions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: clinical_evolutions_appointment_id_fkey
-- ALTER TABLE clinical_evolutions ADD CONSTRAINT clinical_evolutions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: clinical_evolutions_medical_record_id_fkey
-- ALTER TABLE clinical_evolutions ADD CONSTRAINT clinical_evolutions_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES medical_records(id);


-- Table: commission_disputes
CREATE TABLE IF NOT EXISTS commission_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  commission_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  admin_response TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: commission_disputes_tenant_id_fkey
-- ALTER TABLE commission_disputes ADD CONSTRAINT commission_disputes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: commission_disputes_commission_id_fkey
-- ALTER TABLE commission_disputes ADD CONSTRAINT commission_disputes_commission_id_fkey FOREIGN KEY (commission_id) REFERENCES commission_payments(id);

-- FK: commission_disputes_professional_id_fkey
-- ALTER TABLE commission_disputes ADD CONSTRAINT commission_disputes_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(user_id);

-- FK: commission_disputes_resolved_by_fkey
-- ALTER TABLE commission_disputes ADD CONSTRAINT commission_disputes_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(user_id);


-- Table: commission_payments
CREATE TABLE IF NOT EXISTS commission_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: commission_payments_tenant_id_fkey
-- ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: commission_payments_professional_id_fkey
-- ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_commission_payments_created ON public.commission_payments USING btree (created_at);

CREATE INDEX idx_commission_payments_professional ON public.commission_payments USING btree (professional_id);

CREATE INDEX idx_commission_payments_tenant ON public.commission_payments USING btree (tenant_id);


-- Table: commission_rules
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  procedure_id UUID,
  commission_type COMMISSION_TYPE DEFAULT 'percentage'::commission_type,
  commission_value NUMERIC(10,2) DEFAULT 0,
  min_threshold NUMERIC(10,2),
  tier_values JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: commission_rules_tenant_id_fkey
-- ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: commission_rules_professional_id_fkey
-- ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: commission_rules_service_id_fkey
-- ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_service_id_fkey FOREIGN KEY (procedure_id) REFERENCES procedures(id);

CREATE INDEX idx_commission_rules_tenant ON public.commission_rules USING btree (tenant_id);


-- Table: consent_forms
CREATE TABLE IF NOT EXISTS consent_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: consent_forms_tenant_id_fkey
-- ALTER TABLE consent_forms ADD CONSTRAINT consent_forms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: consent_forms_patient_id_fkey
-- ALTER TABLE consent_forms ADD CONSTRAINT consent_forms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_consent_forms_tenant_id ON public.consent_forms USING btree (tenant_id);


-- Table: consent_signing_tokens
CREATE TABLE IF NOT EXISTS consent_signing_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  token TEXT NOT NULL,
  template_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: consent_signing_tokens_tenant_id_fkey
-- ALTER TABLE consent_signing_tokens ADD CONSTRAINT consent_signing_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: consent_signing_tokens_client_id_fkey
-- ALTER TABLE consent_signing_tokens ADD CONSTRAINT consent_signing_tokens_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

CREATE UNIQUE INDEX consent_signing_tokens_token_key ON public.consent_signing_tokens USING btree (token);


-- Table: consent_templates
CREATE TABLE IF NOT EXISTS consent_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_photo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  slug TEXT NOT NULL DEFAULT '',
  body_html TEXT DEFAULT '',
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  template_type TEXT DEFAULT 'html',
  pdf_storage_path TEXT,
  pdf_original_filename TEXT,
  pdf_file_size INTEGER,
  PRIMARY KEY (id),
  CONSTRAINT uq_consent_templates_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_consent_templates_tenant_id ON consent_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consent_templates_tenant_active_sort ON consent_templates(tenant_id, is_active, sort_order);

-- FK: consent_templates_tenant_id_fkey
-- ALTER TABLE consent_templates ADD CONSTRAINT consent_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: contact_messages
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  source TEXT DEFAULT 'website'::text,
  status TEXT DEFAULT 'new'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_contact_messages_email_created ON public.contact_messages USING btree (email, created_at DESC);


-- Table: cost_centers
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: cost_centers_tenant_id_fkey
-- ALTER TABLE cost_centers ADD CONSTRAINT cost_centers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: dental_images
CREATE TABLE IF NOT EXISTS dental_images (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  image_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  tooth_number INTEGER,
  notes TEXT,
  taken_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: dental_images_tenant_id_fkey
-- ALTER TABLE dental_images ADD CONSTRAINT dental_images_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: dental_images_patient_id_fkey
-- ALTER TABLE dental_images ADD CONSTRAINT dental_images_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_dental_images_patient ON public.dental_images USING btree (patient_id);


-- Table: dental_prescriptions
CREATE TABLE IF NOT EXISTS dental_prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  periogram_id UUID,
  odontogram_id UUID,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signed_by_cro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: dental_prescriptions_tenant_id_fkey
-- ALTER TABLE dental_prescriptions ADD CONSTRAINT dental_prescriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: dental_prescriptions_patient_id_fkey
-- ALTER TABLE dental_prescriptions ADD CONSTRAINT dental_prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: dental_prescriptions_professional_id_fkey
-- ALTER TABLE dental_prescriptions ADD CONSTRAINT dental_prescriptions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: dental_prescriptions_periogram_id_fkey
-- ALTER TABLE dental_prescriptions ADD CONSTRAINT dental_prescriptions_periogram_id_fkey FOREIGN KEY (periogram_id) REFERENCES periograms(id);

-- FK: dental_prescriptions_odontogram_id_fkey
-- ALTER TABLE dental_prescriptions ADD CONSTRAINT dental_prescriptions_odontogram_id_fkey FOREIGN KEY (odontogram_id) REFERENCES odontograms(id);


-- Table: discount_coupons
CREATE TABLE IF NOT EXISTS discount_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_percent NUMERIC(5,2),
  discount_amount NUMERIC(10,2),
  valid_until DATE,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: discount_coupons_tenant_id_fkey
-- ALTER TABLE discount_coupons ADD CONSTRAINT discount_coupons_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_discount_coupons_code ON public.discount_coupons USING btree (tenant_id, code);

CREATE INDEX idx_discount_coupons_tenant ON public.discount_coupons USING btree (tenant_id);


-- Table: document_signatures
CREATE TABLE IF NOT EXISTS document_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  signature_method TEXT NOT NULL,
  signature_path TEXT,
  facial_photo_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: document_signatures_tenant_id_fkey
-- ALTER TABLE document_signatures ADD CONSTRAINT document_signatures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: document_signatures_patient_id_fkey
-- ALTER TABLE document_signatures ADD CONSTRAINT document_signatures_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE UNIQUE INDEX document_signatures_patient_id_document_type_document_id_key ON public.document_signatures USING btree (patient_id, document_type, document_id);


-- Table: document_verifications
CREATE TABLE IF NOT EXISTS document_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  document_type VERIFIABLE_DOCUMENT_TYPE NOT NULL,
  document_id UUID NOT NULL,
  document_hash TEXT NOT NULL,
  verification_result BOOLEAN NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verifier_ip INET,
  verifier_user_agent TEXT,
  tenant_id UUID,
  PRIMARY KEY (id)
);

-- FK: document_verifications_tenant_id_fkey
-- ALTER TABLE document_verifications ADD CONSTRAINT document_verifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: dpo_config
CREATE TABLE IF NOT EXISTS dpo_config (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cpf TEXT,
  formacao TEXT,
  certificacoes TEXT[],
  publicado BOOLEAN DEFAULT false,
  url_publicacao TEXT,
  data_nomeacao DATE,
  email_publico TEXT,
  telefone_publico TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: dpo_config_tenant_id_fkey
-- ALTER TABLE dpo_config ADD CONSTRAINT dpo_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX dpo_config_tenant_id_key ON public.dpo_config USING btree (tenant_id);


-- Table: email_verification_codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);


-- Table: exam_results
CREATE TABLE IF NOT EXISTS exam_results (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  exam_type TEXT NOT NULL,
  exam_date DATE,
  results JSONB,
  file_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exam_category TEXT,
  performed_by UUID,
  result_data JSONB,
  PRIMARY KEY (id)
);

-- FK: exam_results_tenant_id_fkey
-- ALTER TABLE exam_results ADD CONSTRAINT exam_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: exam_results_patient_id_fkey
-- ALTER TABLE exam_results ADD CONSTRAINT exam_results_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: exam_results_professional_id_fkey
-- ALTER TABLE exam_results ADD CONSTRAINT exam_results_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: exam_results_performed_by_fkey
-- ALTER TABLE exam_results ADD CONSTRAINT exam_results_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES profiles(id);

CREATE INDEX idx_exam_results_patient_id ON public.exam_results USING btree (patient_id);

CREATE INDEX idx_exam_results_tenant_id ON public.exam_results USING btree (tenant_id);


-- Table: feedback_analysis
CREATE TABLE IF NOT EXISTS feedback_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  sentiment TEXT NOT NULL,
  score NUMERIC(3,2) NOT NULL,
  aspects JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  action_required BOOLEAN DEFAULT false,
  suggested_action TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: feedback_analysis_tenant_id_fkey
-- ALTER TABLE feedback_analysis ADD CONSTRAINT feedback_analysis_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: financial_transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  type TRANSACTION_TYPE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  cost_center_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: financial_transactions_tenant_id_fkey
-- ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: financial_transactions_appointment_id_fkey
-- ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE INDEX idx_financial_transactions_date ON public.financial_transactions USING btree (transaction_date);

CREATE INDEX idx_financial_transactions_tenant_id ON public.financial_transactions USING btree (tenant_id);

CREATE INDEX idx_financial_transactions_tenant_transaction_date ON public.financial_transactions USING btree (tenant_id, transaction_date DESC);

CREATE INDEX idx_financial_transactions_tenant_type_date ON public.financial_transactions USING btree (tenant_id, type, transaction_date DESC);

CREATE INDEX idx_financial_transactions_type ON public.financial_transactions USING btree (type);


-- Table: goal_achievements
CREATE TABLE IF NOT EXISTS goal_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB,
  PRIMARY KEY (id)
);

-- FK: goal_achievements_goal_id_fkey
-- ALTER TABLE goal_achievements ADD CONSTRAINT goal_achievements_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES goals(id);

-- FK: goal_achievements_tenant_id_fkey
-- ALTER TABLE goal_achievements ADD CONSTRAINT goal_achievements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_goal_achievements_goal ON public.goal_achievements USING btree (goal_id);

CREATE INDEX idx_goal_achievements_tenant ON public.goal_achievements USING btree (tenant_id);


-- Table: goal_suggestions
CREATE TABLE IF NOT EXISTS goal_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  suggested_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT,
  target_value NUMERIC(10,2),
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: goal_suggestions_tenant_id_fkey
-- ALTER TABLE goal_suggestions ADD CONSTRAINT goal_suggestions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_goal_suggestions_status ON public.goal_suggestions USING btree (tenant_id, status);

CREATE INDEX idx_goal_suggestions_tenant ON public.goal_suggestions USING btree (tenant_id);


-- Table: goal_templates
CREATE TABLE IF NOT EXISTS goal_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  default_target NUMERIC(10,2),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: goal_templates_tenant_id_fkey
-- ALTER TABLE goal_templates ADD CONSTRAINT goal_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_goal_templates_tenant ON public.goal_templates USING btree (tenant_id);


-- Table: goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,
  target_value NUMERIC(10,2) NOT NULL,
  current_value NUMERIC(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  custom_end DATE,
  custom_start DATE,
  header_priority INTEGER DEFAULT 0,
  parent_goal_id UUID,
  PRIMARY KEY (id)
);

-- FK: goals_tenant_id_fkey
-- ALTER TABLE goals ADD CONSTRAINT goals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: goals_professional_id_fkey
-- ALTER TABLE goals ADD CONSTRAINT goals_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: goals_parent_goal_id_fkey
-- ALTER TABLE goals ADD CONSTRAINT goals_parent_goal_id_fkey FOREIGN KEY (parent_goal_id) REFERENCES goals(id);

CREATE INDEX idx_goals_professional ON public.goals USING btree (professional_id);

CREATE INDEX idx_goals_tenant ON public.goals USING btree (tenant_id);


-- Table: health_credits_balance
CREATE TABLE IF NOT EXISTS health_credits_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_redeemed INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze'::text,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: health_credits_balance_tenant_id_fkey
-- ALTER TABLE health_credits_balance ADD CONSTRAINT health_credits_balance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: health_credits_balance_patient_id_fkey
-- ALTER TABLE health_credits_balance ADD CONSTRAINT health_credits_balance_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE UNIQUE INDEX health_credits_balance_tenant_id_patient_id_key ON public.health_credits_balance USING btree (tenant_id, patient_id);

CREATE INDEX idx_health_credits_balance_tenant_patient ON public.health_credits_balance USING btree (tenant_id, patient_id);


-- Table: health_credits_redemption_config
CREATE TABLE IF NOT EXISTS health_credits_redemption_config (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  credits_per_real NUMERIC NOT NULL DEFAULT 10,
  min_redeem INTEGER NOT NULL DEFAULT 50,
  max_discount_percent NUMERIC NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: health_credits_redemption_config_tenant_id_fkey
-- ALTER TABLE health_credits_redemption_config ADD CONSTRAINT health_credits_redemption_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX health_credits_redemption_config_tenant_id_key ON public.health_credits_redemption_config USING btree (tenant_id);


-- Table: health_credits_rules
CREATE TABLE IF NOT EXISTS health_credits_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: health_credits_rules_tenant_id_fkey
-- ALTER TABLE health_credits_rules ADD CONSTRAINT health_credits_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_health_credits_rules_tenant ON public.health_credits_rules USING btree (tenant_id, is_active);


-- Table: health_credits_transactions
CREATE TABLE IF NOT EXISTS health_credits_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: health_credits_transactions_tenant_id_fkey
-- ALTER TABLE health_credits_transactions ADD CONSTRAINT health_credits_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: health_credits_transactions_patient_id_fkey
-- ALTER TABLE health_credits_transactions ADD CONSTRAINT health_credits_transactions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);


-- Table: hl7_connections
CREATE TABLE IF NOT EXISTS hl7_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 2575,
  direction TEXT NOT NULL,
  message_types TEXT[] DEFAULT '{}'::text[],
  is_active BOOLEAN DEFAULT true,
  auth_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: hl7_connections_tenant_id_fkey
-- ALTER TABLE hl7_connections ADD CONSTRAINT hl7_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_hl7_connections_tenant ON public.hl7_connections USING btree (tenant_id);


-- Table: hl7_field_mappings
CREATE TABLE IF NOT EXISTS hl7_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  hl7_field TEXT NOT NULL,
  local_table TEXT NOT NULL,
  local_column TEXT NOT NULL,
  transform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: hl7_field_mappings_connection_id_fkey
-- ALTER TABLE hl7_field_mappings ADD CONSTRAINT hl7_field_mappings_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES hl7_connections(id);

-- FK: hl7_field_mappings_tenant_id_fkey
-- ALTER TABLE hl7_field_mappings ADD CONSTRAINT hl7_field_mappings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: hl7_message_log
CREATE TABLE IF NOT EXISTS hl7_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  connection_id UUID,
  direction TEXT NOT NULL,
  message_type TEXT,
  raw_message TEXT,
  status TEXT DEFAULT 'received'::text,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: hl7_message_log_tenant_id_fkey
-- ALTER TABLE hl7_message_log ADD CONSTRAINT hl7_message_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: hl7_message_log_connection_id_fkey
-- ALTER TABLE hl7_message_log ADD CONSTRAINT hl7_message_log_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES hl7_connections(id);

CREATE INDEX idx_hl7_message_log_tenant ON public.hl7_message_log USING btree (tenant_id);


-- Table: hl7_patient_mapping
CREATE TABLE IF NOT EXISTS hl7_patient_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  connection_id UUID,
  external_patient_id TEXT NOT NULL,
  external_system TEXT,
  client_id UUID NOT NULL,
  matched_by TEXT,
  confidence_score NUMERIC(3,2),
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: hl7_patient_mapping_tenant_id_fkey
-- ALTER TABLE hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: hl7_patient_mapping_connection_id_fkey
-- ALTER TABLE hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES hl7_connections(id);

-- FK: hl7_patient_mapping_client_id_fkey
-- ALTER TABLE hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: hl7_patient_mapping_verified_by_fkey
-- ALTER TABLE hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES profiles(id);

CREATE UNIQUE INDEX hl7_patient_mapping_tenant_id_external_patient_id_external__key ON public.hl7_patient_mapping USING btree (tenant_id, external_patient_id, external_system);


-- Table: incoming_rnds_bundles
CREATE TABLE IF NOT EXISTS incoming_rnds_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  bundle_type TEXT NOT NULL DEFAULT 'document'::text,
  fhir_bundle JSONB NOT NULL,
  bundle_id TEXT,
  source_cnes TEXT,
  source_name TEXT,
  source_uf TEXT,
  patient_cpf TEXT,
  patient_name TEXT,
  matched_patient_id UUID,
  resource_types TEXT[],
  resource_count INTEGER DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'pending'::text,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: incoming_rnds_bundles_tenant_id_fkey
-- ALTER TABLE incoming_rnds_bundles ADD CONSTRAINT incoming_rnds_bundles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: incoming_rnds_bundles_matched_patient_id_fkey
-- ALTER TABLE incoming_rnds_bundles ADD CONSTRAINT incoming_rnds_bundles_matched_patient_id_fkey FOREIGN KEY (matched_patient_id) REFERENCES patients(id);

-- FK: incoming_rnds_bundles_reviewed_by_fkey
-- ALTER TABLE incoming_rnds_bundles ADD CONSTRAINT incoming_rnds_bundles_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);


-- Table: insurance_plans
CREATE TABLE IF NOT EXISTS insurance_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  ans_code TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: insurance_plans_tenant_id_fkey
-- ALTER TABLE insurance_plans ADD CONSTRAINT insurance_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_insurance_plans_tenant_id ON public.insurance_plans USING btree (tenant_id);


-- Table: internal_messages
CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'general'::text,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB,
  reply_to UUID,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mentions UUID[] DEFAULT '{}'::uuid[],
  PRIMARY KEY (id)
);

-- FK: internal_messages_tenant_id_fkey
-- ALTER TABLE internal_messages ADD CONSTRAINT internal_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_internal_messages_channel ON public.internal_messages USING btree (channel);

CREATE INDEX idx_internal_messages_tenant ON public.internal_messages USING btree (tenant_id);


-- Table: lgpd_consentimentos
CREATE TABLE IF NOT EXISTS lgpd_consentimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  titular_id UUID,
  titular_email TEXT NOT NULL,
  titular_nome TEXT,
  finalidade TEXT NOT NULL,
  descricao TEXT,
  dados_coletados TEXT[],
  consentido BOOLEAN NOT NULL,
  data_consentimento TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_revogacao TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  metodo TEXT,
  evidencia_url TEXT,
  validade_dias INTEGER,
  data_expiracao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: lgpd_consentimentos_tenant_id_fkey
-- ALTER TABLE lgpd_consentimentos ADD CONSTRAINT lgpd_consentimentos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: lgpd_data_requests
CREATE TABLE IF NOT EXISTS lgpd_data_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: lgpd_data_requests_tenant_id_fkey
-- ALTER TABLE lgpd_data_requests ADD CONSTRAINT lgpd_data_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: lgpd_data_requests_patient_id_fkey
-- ALTER TABLE lgpd_data_requests ADD CONSTRAINT lgpd_data_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_lgpd_data_requests_tenant_status ON public.lgpd_data_requests USING btree (tenant_id, status, requested_at DESC);

CREATE INDEX idx_lgpd_requests_tenant ON public.lgpd_data_requests USING btree (tenant_id);


-- Table: lgpd_incidentes
CREATE TABLE IF NOT EXISTS lgpd_incidentes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL,
  dados_afetados TEXT[],
  categorias_dados TEXT[],
  quantidade_titulares_afetados INTEGER,
  titulares_identificados BOOLEAN DEFAULT false,
  data_ocorrencia TIMESTAMPTZ,
  data_deteccao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_contencao TIMESTAMPTZ,
  data_resolucao TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'detectado'::text,
  requer_notificacao_anpd BOOLEAN DEFAULT false,
  notificacao_anpd_enviada BOOLEAN DEFAULT false,
  data_notificacao_anpd TIMESTAMPTZ,
  protocolo_anpd TEXT,
  prazo_notificacao TIMESTAMPTZ,
  requer_notificacao_titulares BOOLEAN DEFAULT false,
  notificacao_titulares_enviada BOOLEAN DEFAULT false,
  data_notificacao_titulares TIMESTAMPTZ,
  medidas_contencao TEXT[],
  medidas_remediacao TEXT[],
  medidas_preventivas TEXT[],
  responsavel_investigacao UUID,
  responsavel_comunicacao UUID,
  evidencias JSONB DEFAULT '[]'::jsonb,
  timeline_acoes JSONB DEFAULT '[]'::jsonb,
  post_mortem TEXT,
  licoes_aprendidas TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: lgpd_incidentes_tenant_id_fkey
-- ALTER TABLE lgpd_incidentes ADD CONSTRAINT lgpd_incidentes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: lgpd_retention_policies
CREATE TABLE IF NOT EXISTS lgpd_retention_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  data_category TEXT NOT NULL DEFAULT 'geral'::text,
  retention_years INTEGER NOT NULL DEFAULT 20,
  legal_basis TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: lgpd_retention_policies_tenant_id_fkey
-- ALTER TABLE lgpd_retention_policies ADD CONSTRAINT lgpd_retention_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX lgpd_retention_policies_tenant_id_key ON public.lgpd_retention_policies USING btree (tenant_id);


-- Table: lgpd_solicitacoes
CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  titular_nome TEXT NOT NULL,
  titular_email TEXT NOT NULL,
  titular_cpf TEXT,
  titular_telefone TEXT,
  tipo TEXT NOT NULL,
  descricao TEXT,
  dados_solicitados TEXT[],
  status TEXT NOT NULL DEFAULT 'recebida'::text,
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  prazo_resposta TIMESTAMPTZ,
  data_resposta TIMESTAMPTZ,
  resposta TEXT,
  motivo_negativa TEXT,
  arquivos_resposta TEXT[],
  atendido_por UUID,
  historico JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: lgpd_solicitacoes_tenant_id_fkey
-- ALTER TABLE lgpd_solicitacoes ADD CONSTRAINT lgpd_solicitacoes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: loyalty_tiers
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  cashback_percent NUMERIC(5,2) DEFAULT 0,
  benefits JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: loyalty_tiers_tenant_id_fkey
-- ALTER TABLE loyalty_tiers ADD CONSTRAINT loyalty_tiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_loyalty_tiers_tenant ON public.loyalty_tiers USING btree (tenant_id);


-- Table: medical_certificates
CREATE TABLE IF NOT EXISTS medical_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  certificate_type TEXT NOT NULL DEFAULT 'atestado'::text,
  content TEXT NOT NULL,
  days_off INTEGER,
  start_date DATE,
  cid_code TEXT,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signature_hash TEXT,
  verification_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT,
  server_timestamp TIMESTAMPTZ,
  signed_by_crm TEXT,
  signed_by_name TEXT,
  signed_by_specialty TEXT,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

-- FK: medical_certificates_tenant_id_fkey
-- ALTER TABLE medical_certificates ADD CONSTRAINT medical_certificates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: medical_certificates_patient_id_fkey
-- ALTER TABLE medical_certificates ADD CONSTRAINT medical_certificates_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: medical_certificates_professional_id_fkey
-- ALTER TABLE medical_certificates ADD CONSTRAINT medical_certificates_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_medical_certificates_tenant_id ON public.medical_certificates USING btree (tenant_id);

CREATE UNIQUE INDEX medical_certificates_verification_code_key ON public.medical_certificates USING btree (verification_code);


-- Table: medical_record_versions
CREATE TABLE IF NOT EXISTS medical_record_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: medical_record_versions_record_id_fkey
-- ALTER TABLE medical_record_versions ADD CONSTRAINT medical_record_versions_record_id_fkey FOREIGN KEY (record_id) REFERENCES medical_records(id);

-- FK: medical_record_versions_tenant_id_fkey
-- ALTER TABLE medical_record_versions ADD CONSTRAINT medical_record_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_medical_record_versions_record ON public.medical_record_versions USING btree (record_id);


-- Table: medical_records
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  appointment_id UUID,
  record_type TEXT DEFAULT 'soap'::text,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  notes TEXT,
  cid_codes TEXT[],
  vital_signs JSONB,
  attachments JSONB,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attendance_number BIGINT,
  attendance_type ATTENDANCE_TYPE DEFAULT 'consulta'::attendance_type,
  server_timestamp TIMESTAMPTZ,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

-- FK: medical_records_tenant_id_fkey
-- ALTER TABLE medical_records ADD CONSTRAINT medical_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: medical_records_patient_id_fkey
-- ALTER TABLE medical_records ADD CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: medical_records_professional_id_fkey
-- ALTER TABLE medical_records ADD CONSTRAINT medical_records_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: medical_records_appointment_id_fkey
-- ALTER TABLE medical_records ADD CONSTRAINT medical_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE INDEX idx_medical_records_appointment_id ON public.medical_records USING btree (appointment_id);

CREATE INDEX idx_medical_records_patient_id ON public.medical_records USING btree (patient_id);

CREATE INDEX idx_medical_records_professional_id ON public.medical_records USING btree (professional_id);

CREATE INDEX idx_medical_records_tenant_id ON public.medical_records USING btree (tenant_id);


-- Table: medical_reports
CREATE TABLE IF NOT EXISTS medical_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  medical_record_id UUID,
  appointment_id UUID,
  tipo TEXT NOT NULL DEFAULT 'medico'::text,
  finalidade TEXT,
  historia_clinica TEXT,
  exame_fisico TEXT,
  exames_complementares TEXT,
  diagnostico TEXT,
  cid10 TEXT,
  conclusao TEXT NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho'::text,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: medical_reports_tenant_id_fkey
-- ALTER TABLE medical_reports ADD CONSTRAINT medical_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: medical_reports_patient_id_fkey
-- ALTER TABLE medical_reports ADD CONSTRAINT medical_reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: medical_reports_professional_id_fkey
-- ALTER TABLE medical_reports ADD CONSTRAINT medical_reports_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: medical_reports_medical_record_id_fkey
-- ALTER TABLE medical_reports ADD CONSTRAINT medical_reports_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES medical_records(id);

-- FK: medical_reports_appointment_id_fkey
-- ALTER TABLE medical_reports ADD CONSTRAINT medical_reports_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);


-- Table: message_templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: message_templates_tenant_id_fkey
-- ALTER TABLE message_templates ADD CONSTRAINT message_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: nfse_invoices
CREATE TABLE IF NOT EXISTS nfse_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  invoice_number TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  external_id TEXT,
  xml_content TEXT,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: nfse_invoices_tenant_id_fkey
-- ALTER TABLE nfse_invoices ADD CONSTRAINT nfse_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: nfse_invoices_patient_id_fkey
-- ALTER TABLE nfse_invoices ADD CONSTRAINT nfse_invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: nfse_invoices_appointment_id_fkey
-- ALTER TABLE nfse_invoices ADD CONSTRAINT nfse_invoices_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE INDEX idx_nfse_invoices_tenant ON public.nfse_invoices USING btree (tenant_id);


-- Table: notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'patient'::text,
  recipient_id UUID,
  channel TEXT NOT NULL,
  template_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  metadata JSONB DEFAULT '{}'::jsonb,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: notification_logs_tenant_id_fkey
-- ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info'::text,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: notifications_tenant_id_fkey
-- ALTER TABLE notifications ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_notifications_created ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);

CREATE INDEX idx_notifications_tenant ON public.notifications USING btree (tenant_id);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


-- Table: nps_responses
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  score INTEGER NOT NULL,
  comment TEXT,
  source TEXT DEFAULT 'whatsapp'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: nps_responses_tenant_id_fkey
-- ALTER TABLE nps_responses ADD CONSTRAINT nps_responses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: nps_responses_patient_id_fkey
-- ALTER TABLE nps_responses ADD CONSTRAINT nps_responses_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_nps_responses_tenant_created ON public.nps_responses USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_nps_tenant ON public.nps_responses USING btree (tenant_id);


-- Table: nursing_evolutions
CREATE TABLE IF NOT EXISTS nursing_evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  professional_id UUID,
  evolution_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  nanda_code TEXT,
  nanda_diagnosis TEXT NOT NULL,
  nic_code TEXT,
  nic_intervention TEXT,
  nic_activities TEXT,
  noc_code TEXT,
  noc_outcome TEXT,
  noc_score_initial INTEGER,
  noc_score_current INTEGER,
  noc_score_target INTEGER,
  notes TEXT,
  vital_signs JSONB,
  status TEXT NOT NULL DEFAULT 'active'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: nursing_evolutions_tenant_id_fkey
-- ALTER TABLE nursing_evolutions ADD CONSTRAINT nursing_evolutions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: nursing_evolutions_client_id_fkey
-- ALTER TABLE nursing_evolutions ADD CONSTRAINT nursing_evolutions_client_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: nursing_evolutions_appointment_id_fkey
-- ALTER TABLE nursing_evolutions ADD CONSTRAINT nursing_evolutions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: nursing_evolutions_professional_id_fkey
-- ALTER TABLE nursing_evolutions ADD CONSTRAINT nursing_evolutions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);


-- Table: odontogram_annotations
CREATE TABLE IF NOT EXISTS odontogram_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  odontogram_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER,
  annotation_type TEXT,
  content TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: odontogram_annotations_odontogram_id_fkey
-- ALTER TABLE odontogram_annotations ADD CONSTRAINT odontogram_annotations_odontogram_id_fkey FOREIGN KEY (odontogram_id) REFERENCES odontograms(id);

-- FK: odontogram_annotations_tenant_id_fkey
-- ALTER TABLE odontogram_annotations ADD CONSTRAINT odontogram_annotations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_annotations_odontogram ON public.odontogram_annotations USING btree (odontogram_id);


-- Table: odontogram_teeth
CREATE TABLE IF NOT EXISTS odontogram_teeth (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  odontogram_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER NOT NULL,
  status TEXT DEFAULT 'healthy'::text,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: odontogram_teeth_odontogram_id_fkey
-- ALTER TABLE odontogram_teeth ADD CONSTRAINT odontogram_teeth_odontogram_id_fkey FOREIGN KEY (odontogram_id) REFERENCES odontograms(id);

-- FK: odontogram_teeth_tenant_id_fkey
-- ALTER TABLE odontogram_teeth ADD CONSTRAINT odontogram_teeth_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_odontogram_teeth_odontogram ON public.odontogram_teeth USING btree (odontogram_id);


-- Table: odontogram_tooth_history
CREATE TABLE IF NOT EXISTS odontogram_tooth_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  odontogram_id UUID NOT NULL,
  tooth_number INTEGER NOT NULL,
  previous_condition TEXT,
  new_condition TEXT NOT NULL,
  previous_surfaces TEXT,
  new_surfaces TEXT,
  previous_notes TEXT,
  new_notes TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  PRIMARY KEY (id)
);

-- FK: odontogram_tooth_history_odontogram_id_fkey
-- ALTER TABLE odontogram_tooth_history ADD CONSTRAINT odontogram_tooth_history_odontogram_id_fkey FOREIGN KEY (odontogram_id) REFERENCES odontograms(id);

-- FK: odontogram_tooth_history_changed_by_fkey
-- ALTER TABLE odontogram_tooth_history ADD CONSTRAINT odontogram_tooth_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id);


-- Table: odontogram_tooth_surfaces
CREATE TABLE IF NOT EXISTS odontogram_tooth_surfaces (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tooth_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  surface TEXT NOT NULL,
  condition TEXT DEFAULT 'healthy'::text,
  procedure_done TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: odontogram_tooth_surfaces_tooth_id_fkey
-- ALTER TABLE odontogram_tooth_surfaces ADD CONSTRAINT odontogram_tooth_surfaces_tooth_id_fkey FOREIGN KEY (tooth_id) REFERENCES odontogram_teeth(id);

-- FK: odontogram_tooth_surfaces_tenant_id_fkey
-- ALTER TABLE odontogram_tooth_surfaces ADD CONSTRAINT odontogram_tooth_surfaces_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: odontograms
CREATE TABLE IF NOT EXISTS odontograms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: odontograms_tenant_id_fkey
-- ALTER TABLE odontograms ADD CONSTRAINT odontograms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: odontograms_patient_id_fkey
-- ALTER TABLE odontograms ADD CONSTRAINT odontograms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: odontograms_professional_id_fkey
-- ALTER TABLE odontograms ADD CONSTRAINT odontograms_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_odontograms_patient ON public.odontograms USING btree (patient_id);

CREATE INDEX idx_odontograms_tenant_patient ON public.odontograms USING btree (tenant_id, patient_id);


-- Table: offline_cache_metadata
CREATE TABLE IF NOT EXISTS offline_cache_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  data_type TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  sync_version INTEGER DEFAULT 1,
  size_bytes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: offline_cache_metadata_tenant_id_fkey
-- ALTER TABLE offline_cache_metadata ADD CONSTRAINT offline_cache_metadata_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX offline_cache_metadata_user_id_cache_key_key ON public.offline_cache_metadata USING btree (user_id, cache_key);


-- Table: ona_indicators
CREATE TABLE IF NOT EXISTS ona_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  indicator_code TEXT NOT NULL,
  indicator_name TEXT NOT NULL,
  value NUMERIC(10,4),
  target_value NUMERIC(10,4),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: ona_indicators_tenant_id_fkey
-- ALTER TABLE ona_indicators ADD CONSTRAINT ona_indicators_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: order_items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: order_items_order_id_fkey
-- ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);

-- FK: order_items_tenant_id_fkey
-- ALTER TABLE order_items ADD CONSTRAINT order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);

CREATE INDEX idx_order_items_tenant ON public.order_items USING btree (tenant_id);


-- Table: orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'open'::text,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: orders_tenant_id_fkey
-- ALTER TABLE orders ADD CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: orders_patient_id_fkey
-- ALTER TABLE orders ADD CONSTRAINT orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: orders_appointment_id_fkey
-- ALTER TABLE orders ADD CONSTRAINT orders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE INDEX idx_orders_appointment ON public.orders USING btree (appointment_id);

CREATE INDEX idx_orders_tenant_created ON public.orders USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_orders_tenant_id ON public.orders USING btree (tenant_id);

CREATE INDEX idx_orders_tenant_status ON public.orders USING btree (tenant_id, status);


-- Table: override_audit_log
CREATE TABLE IF NOT EXISTS override_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  override_type TEXT NOT NULL,
  override_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: override_audit_log_tenant_id_fkey
-- ALTER TABLE override_audit_log ADD CONSTRAINT override_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: override_audit_log_changed_by_fkey
-- ALTER TABLE override_audit_log ADD CONSTRAINT override_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id);


-- Table: patient_access_attempts
CREATE TABLE IF NOT EXISTS patient_access_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  identifier_hash TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);


-- Table: patient_achievements
CREATE TABLE IF NOT EXISTS patient_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_achievements_tenant_id_fkey
-- ALTER TABLE patient_achievements ADD CONSTRAINT patient_achievements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_achievements_patient_id_fkey
-- ALTER TABLE patient_achievements ADD CONSTRAINT patient_achievements_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);


-- Table: patient_activity_log
CREATE TABLE IF NOT EXISTS patient_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_hint TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);


-- Table: patient_calls
CREATE TABLE IF NOT EXISTS patient_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  triage_id UUID,
  room_id UUID,
  room_name TEXT,
  professional_id UUID,
  professional_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting'::text,
  priority INTEGER DEFAULT 5,
  priority_label TEXT,
  call_number INTEGER,
  times_called INTEGER DEFAULT 0,
  first_called_at TIMESTAMPTZ,
  last_called_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_service_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_calls_tenant_id_fkey
-- ALTER TABLE patient_calls ADD CONSTRAINT patient_calls_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_calls_client_id_fkey
-- ALTER TABLE patient_calls ADD CONSTRAINT patient_calls_client_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: patient_calls_appointment_id_fkey
-- ALTER TABLE patient_calls ADD CONSTRAINT patient_calls_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: patient_calls_triage_id_fkey
-- ALTER TABLE patient_calls ADD CONSTRAINT patient_calls_triage_id_fkey FOREIGN KEY (triage_id) REFERENCES triage_records(id);

-- FK: patient_calls_room_id_fkey
-- ALTER TABLE patient_calls ADD CONSTRAINT patient_calls_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id);

-- FK: patient_calls_professional_id_fkey
-- ALTER TABLE patient_calls ADD CONSTRAINT patient_calls_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);


-- Table: patient_consents
CREATE TABLE IF NOT EXISTS patient_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  template_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'pending'::text,
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  photo_url TEXT,
  sealed_pdf_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  consent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_consents_tenant_id_fkey
-- ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_consents_patient_id_fkey
-- ALTER TABLE patient_consents ADD CONSTRAINT patient_consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_patient_consents_patient ON public.patient_consents USING btree (patient_id);

CREATE INDEX idx_patient_consents_tenant ON public.patient_consents USING btree (tenant_id);


-- Table: patient_deletion_requests
CREATE TABLE IF NOT EXISTS patient_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + '30 days'::interval),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tenant_id UUID,
  PRIMARY KEY (id)
);

-- FK: patient_deletion_requests_patient_id_fkey
-- ALTER TABLE patient_deletion_requests ADD CONSTRAINT patient_deletion_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: patient_deletion_requests_tenant_id_fkey
-- ALTER TABLE patient_deletion_requests ADD CONSTRAINT patient_deletion_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: patient_dependents
CREATE TABLE IF NOT EXISTS patient_dependents (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  guardian_patient_id UUID NOT NULL,
  dependent_patient_id UUID NOT NULL,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_dependents_tenant_id_fkey
-- ALTER TABLE patient_dependents ADD CONSTRAINT patient_dependents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_dependents_guardian_patient_id_fkey
-- ALTER TABLE patient_dependents ADD CONSTRAINT patient_dependents_guardian_patient_id_fkey FOREIGN KEY (guardian_patient_id) REFERENCES patients(id);

-- FK: patient_dependents_dependent_patient_id_fkey
-- ALTER TABLE patient_dependents ADD CONSTRAINT patient_dependents_dependent_patient_id_fkey FOREIGN KEY (dependent_patient_id) REFERENCES patients(id);


-- Table: patient_invoices
CREATE TABLE IF NOT EXISTS patient_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  description TEXT,
  external_payment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_invoices_tenant_id_fkey
-- ALTER TABLE patient_invoices ADD CONSTRAINT patient_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_invoices_patient_id_fkey
-- ALTER TABLE patient_invoices ADD CONSTRAINT patient_invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_patient_invoices_patient ON public.patient_invoices USING btree (patient_id);


-- Table: patient_messages
CREATE TABLE IF NOT EXISTS patient_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_messages_tenant_id_fkey
-- ALTER TABLE patient_messages ADD CONSTRAINT patient_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_messages_patient_id_fkey
-- ALTER TABLE patient_messages ADD CONSTRAINT patient_messages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: patient_messages_professional_id_fkey
-- ALTER TABLE patient_messages ADD CONSTRAINT patient_messages_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_patient_messages_patient ON public.patient_messages USING btree (patient_id);


-- Table: patient_notification_preferences
CREATE TABLE IF NOT EXISTS patient_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  opt_out_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_notification_preferences_client_id_fkey
-- ALTER TABLE patient_notification_preferences ADD CONSTRAINT patient_notification_preferences_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: patient_notification_preferences_tenant_id_fkey
-- ALTER TABLE patient_notification_preferences ADD CONSTRAINT patient_notification_preferences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX patient_notification_preferences_client_id_tenant_id_key ON public.patient_notification_preferences USING btree (client_id, tenant_id);


-- Table: patient_notifications
CREATE TABLE IF NOT EXISTS patient_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info'::text,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_notifications_tenant_id_fkey
-- ALTER TABLE patient_notifications ADD CONSTRAINT patient_notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_notifications_patient_id_fkey
-- ALTER TABLE patient_notifications ADD CONSTRAINT patient_notifications_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_patient_notifications_patient ON public.patient_notifications USING btree (patient_id);


-- Table: patient_onboarding
CREATE TABLE IF NOT EXISTS patient_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  tour_completed BOOLEAN NOT NULL DEFAULT false,
  tour_completed_at TIMESTAMPTZ,
  tour_skipped BOOLEAN NOT NULL DEFAULT false,
  first_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  login_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX patient_onboarding_patient_user_id_key ON public.patient_onboarding USING btree (patient_user_id);


-- Table: patient_packages
CREATE TABLE IF NOT EXISTS patient_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  used_sessions INTEGER DEFAULT 0,
  price NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'active'::text,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: client_packages_tenant_id_fkey
-- ALTER TABLE patient_packages ADD CONSTRAINT client_packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: client_packages_patient_id_fkey
-- ALTER TABLE patient_packages ADD CONSTRAINT client_packages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_client_packages_patient ON public.patient_packages USING btree (patient_id);


-- Table: patient_payments
CREATE TABLE IF NOT EXISTS patient_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  invoice_id UUID,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  external_id TEXT,
  status TEXT DEFAULT 'confirmed'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_payments_tenant_id_fkey
-- ALTER TABLE patient_payments ADD CONSTRAINT patient_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_payments_patient_id_fkey
-- ALTER TABLE patient_payments ADD CONSTRAINT patient_payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: patient_payments_invoice_id_fkey
-- ALTER TABLE patient_payments ADD CONSTRAINT patient_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES patient_invoices(id);


-- Table: patient_profiles
CREATE TABLE IF NOT EXISTS patient_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  patient_id UUID,
  tenant_id UUID NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  access_code TEXT,
  status TEXT DEFAULT 'active'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_profiles_patient_id_fkey
-- ALTER TABLE patient_profiles ADD CONSTRAINT patient_profiles_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: patient_profiles_tenant_id_fkey
-- ALTER TABLE patient_profiles ADD CONSTRAINT patient_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_patient_profiles_patient ON public.patient_profiles USING btree (patient_id);

CREATE INDEX idx_patient_profiles_tenant ON public.patient_profiles USING btree (tenant_id);

CREATE UNIQUE INDEX patient_profiles_user_id_key ON public.patient_profiles USING btree (user_id);


-- Table: patient_proms
CREATE TABLE IF NOT EXISTS patient_proms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  questionnaire_type TEXT NOT NULL,
  responses JSONB NOT NULL,
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_proms_tenant_id_fkey
-- ALTER TABLE patient_proms ADD CONSTRAINT patient_proms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_proms_patient_id_fkey
-- ALTER TABLE patient_proms ADD CONSTRAINT patient_proms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_proms_patient ON public.patient_proms USING btree (patient_id, created_at DESC);

CREATE INDEX idx_proms_tenant ON public.patient_proms USING btree (tenant_id, created_at DESC);


-- Table: patient_uploaded_exams
CREATE TABLE IF NOT EXISTS patient_uploaded_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream'::text,
  exam_name TEXT NOT NULL DEFAULT ''::text,
  exam_date DATE,
  notes TEXT DEFAULT ''::text,
  status TEXT NOT NULL DEFAULT 'pendente'::text,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_uploaded_exams_tenant_id_fkey
-- ALTER TABLE patient_uploaded_exams ADD CONSTRAINT patient_uploaded_exams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_uploaded_exams_reviewed_by_fkey
-- ALTER TABLE patient_uploaded_exams ADD CONSTRAINT patient_uploaded_exams_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);


-- Table: patient_vaccinations
CREATE TABLE IF NOT EXISTS patient_vaccinations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  vaccine_name TEXT NOT NULL,
  dose TEXT,
  administered_at DATE,
  lot_number TEXT,
  manufacturer TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: patient_vaccinations_tenant_id_fkey
-- ALTER TABLE patient_vaccinations ADD CONSTRAINT patient_vaccinations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: patient_vaccinations_patient_id_fkey
-- ALTER TABLE patient_vaccinations ADD CONSTRAINT patient_vaccinations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);


-- Table: patients
CREATE TABLE IF NOT EXISTS patients (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  blood_type TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  marketing_opt_out BOOLEAN DEFAULT false,
  photo_url TEXT,
  access_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_of_birth DATE,
  marital_status TEXT,
  street TEXT,
  street_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  insurance_plan_id UUID,
  insurance_card_number TEXT,
  PRIMARY KEY (id)
);

-- FK: clients_tenant_id_fkey
-- ALTER TABLE patients ADD CONSTRAINT clients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_clients_cpf ON public.patients USING btree (cpf);

CREATE INDEX idx_clients_email ON public.patients USING btree (email);

CREATE INDEX idx_clients_name ON public.patients USING btree (tenant_id, name);

CREATE INDEX idx_clients_tenant_id ON public.patients USING btree (tenant_id);


-- Table: payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other'::text,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  code TEXT,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id)
);

-- FK: payment_methods_tenant_id_fkey
-- ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_payment_methods_tenant ON public.payment_methods USING btree (tenant_id);

CREATE UNIQUE INDEX payment_methods_tenant_id_code_key ON public.payment_methods USING btree (tenant_id, code);


-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL,
  payment_method_id UUID,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'confirmed'::text,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: payments_tenant_id_fkey
-- ALTER TABLE payments ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: payments_order_id_fkey
-- ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);

-- FK: payments_payment_method_id_fkey
-- ALTER TABLE payments ADD CONSTRAINT payments_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id);

CREATE INDEX idx_payments_order ON public.payments USING btree (order_id);

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id);

CREATE INDEX idx_payments_tenant ON public.payments USING btree (tenant_id);


-- Table: periogram_measurements
CREATE TABLE IF NOT EXISTS periogram_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  periogram_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER NOT NULL,
  site TEXT NOT NULL,
  probing_depth INTEGER,
  gingival_margin INTEGER,
  bleeding BOOLEAN DEFAULT false,
  plaque BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: periogram_measurements_periogram_id_fkey
-- ALTER TABLE periogram_measurements ADD CONSTRAINT periogram_measurements_periogram_id_fkey FOREIGN KEY (periogram_id) REFERENCES periograms(id);

-- FK: periogram_measurements_tenant_id_fkey
-- ALTER TABLE periogram_measurements ADD CONSTRAINT periogram_measurements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: periograms
CREATE TABLE IF NOT EXISTS periograms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: periograms_tenant_id_fkey
-- ALTER TABLE periograms ADD CONSTRAINT periograms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: periograms_patient_id_fkey
-- ALTER TABLE periograms ADD CONSTRAINT periograms_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: periograms_professional_id_fkey
-- ALTER TABLE periograms ADD CONSTRAINT periograms_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_periograms_patient ON public.periograms USING btree (patient_id);


-- Table: permission_overrides
CREATE TABLE IF NOT EXISTS permission_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  resource TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: permission_overrides_tenant_id_fkey
-- ALTER TABLE permission_overrides ADD CONSTRAINT permission_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX permission_overrides_tenant_id_user_id_resource_key ON public.permission_overrides USING btree (tenant_id, user_id, resource);


-- Table: points_ledger
CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: points_ledger_wallet_id_fkey
-- ALTER TABLE points_ledger ADD CONSTRAINT points_ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES points_wallets(id);

-- FK: points_ledger_tenant_id_fkey
-- ALTER TABLE points_ledger ADD CONSTRAINT points_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_points_ledger_wallet ON public.points_ledger USING btree (wallet_id);


-- Table: points_wallets
CREATE TABLE IF NOT EXISTS points_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: points_wallets_tenant_id_fkey
-- ALTER TABLE points_wallets ADD CONSTRAINT points_wallets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: points_wallets_patient_id_fkey
-- ALTER TABLE points_wallets ADD CONSTRAINT points_wallets_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

CREATE INDEX idx_points_wallets_patient ON public.points_wallets USING btree (patient_id);

CREATE INDEX idx_points_wallets_tenant ON public.points_wallets USING btree (tenant_id);

CREATE UNIQUE INDEX points_wallets_patient_id_key ON public.points_wallets USING btree (patient_id);


-- Table: pre_consultation_forms
CREATE TABLE IF NOT EXISTS pre_consultation_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  service_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: pre_consultation_forms_tenant_id_fkey
-- ALTER TABLE pre_consultation_forms ADD CONSTRAINT pre_consultation_forms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: pre_consultation_forms_service_id_fkey
-- ALTER TABLE pre_consultation_forms ADD CONSTRAINT pre_consultation_forms_service_id_fkey FOREIGN KEY (service_id) REFERENCES procedures(id);


-- Table: pre_consultation_responses
CREATE TABLE IF NOT EXISTS pre_consultation_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  form_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: pre_consultation_responses_tenant_id_fkey
-- ALTER TABLE pre_consultation_responses ADD CONSTRAINT pre_consultation_responses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: pre_consultation_responses_appointment_id_fkey
-- ALTER TABLE pre_consultation_responses ADD CONSTRAINT pre_consultation_responses_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: pre_consultation_responses_form_id_fkey
-- ALTER TABLE pre_consultation_responses ADD CONSTRAINT pre_consultation_responses_form_id_fkey FOREIGN KEY (form_id) REFERENCES pre_consultation_forms(id);


-- Table: prescription_refill_requests
CREATE TABLE IF NOT EXISTS prescription_refill_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  prescription_id UUID,
  medication_name TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: prescription_refill_requests_tenant_id_fkey
-- ALTER TABLE prescription_refill_requests ADD CONSTRAINT prescription_refill_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: prescription_refill_requests_patient_id_fkey
-- ALTER TABLE prescription_refill_requests ADD CONSTRAINT prescription_refill_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);


-- Table: prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  appointment_id UUID,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  is_controlled BOOLEAN DEFAULT false,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT,
  digital_hash TEXT,
  server_timestamp TIMESTAMPTZ,
  signed_by_crm TEXT,
  signed_by_name TEXT,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

-- FK: prescriptions_tenant_id_fkey
-- ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: prescriptions_patient_id_fkey
-- ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: prescriptions_professional_id_fkey
-- ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: prescriptions_appointment_id_fkey
-- ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions USING btree (patient_id);

CREATE INDEX idx_prescriptions_tenant_id ON public.prescriptions USING btree (tenant_id);


-- Table: procedures
CREATE TABLE IF NOT EXISTS procedures (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  commission_type COMMISSION_TYPE,
  commission_value NUMERIC(10,2) DEFAULT 0,
  category TEXT,
  tuss_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_authorization BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: services_tenant_id_fkey
-- ALTER TABLE procedures ADD CONSTRAINT services_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_services_tenant_id ON public.procedures USING btree (tenant_id);


-- Table: product_categories
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: product_categories_tenant_id_fkey
-- ALTER TABLE product_categories ADD CONSTRAINT product_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_product_categories_tenant_id ON public.product_categories USING btree (tenant_id);


-- Table: product_usage
CREATE TABLE IF NOT EXISTS product_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un'::text,
  batch_number TEXT,
  expiry_date DATE,
  zone TEXT,
  procedure_type TEXT,
  notes TEXT,
  applied_by UUID,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: product_usage_tenant_id_fkey
-- ALTER TABLE product_usage ADD CONSTRAINT product_usage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: product_usage_product_id_fkey
-- ALTER TABLE product_usage ADD CONSTRAINT product_usage_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);

-- FK: product_usage_patient_id_fkey
-- ALTER TABLE product_usage ADD CONSTRAINT product_usage_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: product_usage_appointment_id_fkey
-- ALTER TABLE product_usage ADD CONSTRAINT product_usage_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: product_usage_applied_by_fkey
-- ALTER TABLE product_usage ADD CONSTRAINT product_usage_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES profiles(id);

CREATE INDEX idx_product_usage_appointment ON public.product_usage USING btree (appointment_id);

CREATE INDEX idx_product_usage_patient ON public.product_usage USING btree (patient_id);

CREATE INDEX idx_product_usage_product ON public.product_usage USING btree (product_id);

CREATE INDEX idx_product_usage_tenant ON public.product_usage USING btree (tenant_id);


-- Table: products
CREATE TABLE IF NOT EXISTS products (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(10,2) DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 5,
  category_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_controlled BOOLEAN DEFAULT false,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: products_tenant_id_fkey
-- ALTER TABLE products ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_products_category ON public.products USING btree (category_id);

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);

CREATE INDEX idx_products_tenant_id ON public.products USING btree (tenant_id);


-- Table: professional_commissions
CREATE TABLE IF NOT EXISTS professional_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  appointment_id UUID,
  service_name TEXT,
  service_price NUMERIC(10,2) DEFAULT 0,
  commission_type COMMISSION_TYPE DEFAULT 'percentage'::commission_type,
  commission_value NUMERIC(10,2) DEFAULT 0,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending'::text,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: professional_commissions_tenant_id_fkey
-- ALTER TABLE professional_commissions ADD CONSTRAINT professional_commissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: professional_commissions_professional_id_fkey
-- ALTER TABLE professional_commissions ADD CONSTRAINT professional_commissions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: professional_commissions_appointment_id_fkey
-- ALTER TABLE professional_commissions ADD CONSTRAINT professional_commissions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

CREATE INDEX idx_commissions_professional ON public.professional_commissions USING btree (professional_id);

CREATE INDEX idx_commissions_tenant_id ON public.professional_commissions USING btree (tenant_id);

CREATE INDEX idx_professional_commissions_tenant ON public.professional_commissions USING btree (tenant_id);


-- Table: professional_payment_accounts
CREATE TABLE IF NOT EXISTS professional_payment_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  gateway_id UUID NOT NULL,
  provider PAYMENT_GATEWAY_PROVIDER NOT NULL,
  recipient_id TEXT,
  wallet_id TEXT,
  account_id TEXT,
  pix_key TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT DEFAULT 'pending'::text,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: professional_payment_accounts_tenant_id_fkey
-- ALTER TABLE professional_payment_accounts ADD CONSTRAINT professional_payment_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: professional_payment_accounts_professional_id_fkey
-- ALTER TABLE professional_payment_accounts ADD CONSTRAINT professional_payment_accounts_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(user_id);

-- FK: professional_payment_accounts_gateway_id_fkey
-- ALTER TABLE professional_payment_accounts ADD CONSTRAINT professional_payment_accounts_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES tenant_payment_gateways(id);

CREATE UNIQUE INDEX professional_payment_accounts_tenant_id_professional_id_gat_key ON public.professional_payment_accounts USING btree (tenant_id, professional_id, gateway_id);


-- Table: professional_tier_tracking
CREATE TABLE IF NOT EXISTS professional_tier_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  rule_id UUID NOT NULL,
  current_tier_index INTEGER NOT NULL DEFAULT 0,
  current_tier_value NUMERIC(5,2) NOT NULL DEFAULT 0,
  monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: professional_tier_tracking_tenant_id_fkey
-- ALTER TABLE professional_tier_tracking ADD CONSTRAINT professional_tier_tracking_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: professional_tier_tracking_professional_id_fkey
-- ALTER TABLE professional_tier_tracking ADD CONSTRAINT professional_tier_tracking_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(user_id);

-- FK: professional_tier_tracking_rule_id_fkey
-- ALTER TABLE professional_tier_tracking ADD CONSTRAINT professional_tier_tracking_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES commission_rules(id);

CREATE UNIQUE INDEX professional_tier_tracking_tenant_id_professional_id_rule_i_key ON public.professional_tier_tracking USING btree (tenant_id, professional_id, rule_id);


-- Table: professional_working_hours
CREATE TABLE IF NOT EXISTS professional_working_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: professional_working_hours_tenant_id_fkey
-- ALTER TABLE professional_working_hours ADD CONSTRAINT professional_working_hours_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: professional_working_hours_professional_id_fkey
-- ALTER TABLE professional_working_hours ADD CONSTRAINT professional_working_hours_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_pwh_tenant_prof ON public.professional_working_hours USING btree (tenant_id, professional_id);

CREATE INDEX idx_working_hours_professional ON public.professional_working_hours USING btree (professional_id);


-- Table: profile_certificates
CREATE TABLE IF NOT EXISTS profile_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  certificate_type CERTIFICATE_TYPE NOT NULL DEFAULT 'A1'::certificate_type,
  common_name TEXT NOT NULL,
  cpf_cnpj TEXT,
  issuer TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  not_before TIMESTAMPTZ NOT NULL,
  not_after TIMESTAMPTZ NOT NULL,
  thumbprint TEXT NOT NULL,
  encrypted_pfx BYTEA,
  encryption_iv BYTEA,
  encryption_salt BYTEA,
  a3_thumbprint TEXT,
  cloud_provider TEXT,
  cloud_credential_id TEXT,
  cloud_access_token TEXT,
  cloud_refresh_token TEXT,
  cloud_token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);

-- FK: profile_certificates_profile_id_fkey
-- ALTER TABLE profile_certificates ADD CONSTRAINT profile_certificates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id);

-- FK: profile_certificates_tenant_id_fkey
-- ALTER TABLE profile_certificates ADD CONSTRAINT profile_certificates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX unique_profile_thumbprint ON public.profile_certificates USING btree (profile_id, thumbprint);


-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  professional_type TEXT,
  council_type TEXT,
  council_number TEXT,
  council_state TEXT,
  specialty TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: profiles_tenant_id_fkey
-- ALTER TABLE profiles ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);

CREATE INDEX idx_profiles_tenant_id ON public.profiles USING btree (tenant_id);

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);

CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles USING btree (user_id);


-- Table: prontuario_exports
CREATE TABLE IF NOT EXISTS prontuario_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  client_name VARCHAR(200) NOT NULL,
  client_cpf VARCHAR(14),
  include_prontuarios BOOLEAN DEFAULT true,
  include_receituarios BOOLEAN DEFAULT true,
  include_atestados BOOLEAN DEFAULT true,
  include_laudos BOOLEAN DEFAULT true,
  include_evolucoes BOOLEAN DEFAULT true,
  include_exames BOOLEAN DEFAULT true,
  include_anexos BOOLEAN DEFAULT true,
  data_inicio DATE,
  data_fim DATE,
  pdf_url TEXT,
  pdf_size_bytes INTEGER,
  xml_url TEXT,
  xml_size_bytes INTEGER,
  zip_url TEXT,
  zip_size_bytes INTEGER,
  content_hash TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256'::character varying,
  tsa_timestamp_id UUID,
  status VARCHAR(20) DEFAULT 'processing'::character varying,
  error_message TEXT,
  requested_by UUID,
  requested_reason TEXT,
  download_count INTEGER DEFAULT 0,
  last_download_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: prontuario_exports_tenant_id_fkey
-- ALTER TABLE prontuario_exports ADD CONSTRAINT prontuario_exports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: prontuario_exports_client_id_fkey
-- ALTER TABLE prontuario_exports ADD CONSTRAINT prontuario_exports_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: prontuario_exports_tsa_timestamp_id_fkey
-- ALTER TABLE prontuario_exports ADD CONSTRAINT prontuario_exports_tsa_timestamp_id_fkey FOREIGN KEY (tsa_timestamp_id) REFERENCES tsa_timestamps(id);


-- Table: purchase_items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL,
  product_id UUID,
  tenant_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: purchase_items_purchase_id_fkey
-- ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id);

-- FK: purchase_items_product_id_fkey
-- ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);

-- FK: purchase_items_tenant_id_fkey
-- ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_purchase_items_purchase ON public.purchase_items USING btree (purchase_id);

CREATE INDEX idx_purchase_items_purchase_product ON public.purchase_items USING btree (purchase_id, product_id);


-- Table: purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  supplier_id UUID,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending'::text,
  notes TEXT,
  invoice_number TEXT,
  purchase_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: purchases_tenant_id_fkey
-- ALTER TABLE purchases ADD CONSTRAINT purchases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: purchases_supplier_id_fkey
-- ALTER TABLE purchases ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

CREATE INDEX idx_purchases_tenant_id ON public.purchases USING btree (tenant_id);


-- Table: push_notifications_log
CREATE TABLE IF NOT EXISTS push_notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  subscription_id UUID,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  status VARCHAR(20) DEFAULT 'sent'::character varying,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);

-- FK: push_notifications_log_tenant_id_fkey
-- ALTER TABLE push_notifications_log ADD CONSTRAINT push_notifications_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: push_notifications_log_subscription_id_fkey
-- ALTER TABLE push_notifications_log ADD CONSTRAINT push_notifications_log_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id);


-- Table: push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  endpoint TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'web'::text,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: push_subscriptions_tenant_id_fkey
-- ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


-- Table: record_field_templates
CREATE TABLE IF NOT EXISTS record_field_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  specialty_id UUID,
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: record_field_templates_tenant_id_fkey
-- ALTER TABLE record_field_templates ADD CONSTRAINT record_field_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: record_field_templates_specialty_id_fkey
-- ALTER TABLE record_field_templates ADD CONSTRAINT record_field_templates_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES specialties(id);


-- Table: referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  from_professional_id UUID,
  to_specialty TEXT,
  to_professional_name TEXT,
  reason TEXT,
  urgency TEXT DEFAULT 'routine'::text,
  notes TEXT,
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: referrals_tenant_id_fkey
-- ALTER TABLE referrals ADD CONSTRAINT referrals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: referrals_patient_id_fkey
-- ALTER TABLE referrals ADD CONSTRAINT referrals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: referrals_from_professional_id_fkey
-- ALTER TABLE referrals ADD CONSTRAINT referrals_from_professional_id_fkey FOREIGN KEY (from_professional_id) REFERENCES profiles(id);

CREATE INDEX idx_referrals_tenant_id ON public.referrals USING btree (tenant_id);


-- Table: report_definitions
CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category REPORT_CATEGORY NOT NULL DEFAULT 'custom'::report_category,
  is_template BOOLEAN DEFAULT false,
  template_id UUID,
  base_table VARCHAR(100) NOT NULL,
  joins JSONB DEFAULT '[]'::jsonb,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_filters JSONB DEFAULT '[]'::jsonb,
  group_by JSONB DEFAULT '[]'::jsonb,
  order_by JSONB DEFAULT '[]'::jsonb,
  chart_type REPORT_CHART_TYPE DEFAULT 'none'::report_chart_type,
  chart_config JSONB DEFAULT '{}'::jsonb,
  icon VARCHAR(50),
  color VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: report_definitions_tenant_id_fkey
-- ALTER TABLE report_definitions ADD CONSTRAINT report_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: report_definitions_template_id_fkey
-- ALTER TABLE report_definitions ADD CONSTRAINT report_definitions_template_id_fkey FOREIGN KEY (template_id) REFERENCES report_definitions(id);


-- Table: report_executions
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  report_definition_id UUID,
  saved_report_id UUID,
  schedule_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  parameters JSONB DEFAULT '{}'::jsonb,
  result_url TEXT,
  error_message TEXT,
  rows_count INTEGER,
  execution_time_ms INTEGER,
  output_format TEXT DEFAULT 'pdf'::text,
  file_size_bytes BIGINT,
  executed_by UUID,
  executed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: report_executions_tenant_id_fkey
-- ALTER TABLE report_executions ADD CONSTRAINT report_executions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: report_executions_report_definition_id_fkey
-- ALTER TABLE report_executions ADD CONSTRAINT report_executions_report_definition_id_fkey FOREIGN KEY (report_definition_id) REFERENCES report_definitions(id);

-- FK: report_executions_saved_report_id_fkey
-- ALTER TABLE report_executions ADD CONSTRAINT report_executions_saved_report_id_fkey FOREIGN KEY (saved_report_id) REFERENCES user_saved_reports(id);

-- FK: report_executions_schedule_id_fkey
-- ALTER TABLE report_executions ADD CONSTRAINT report_executions_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES report_schedules(id);


-- Table: report_schedules
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  saved_report_id UUID NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'daily'::text,
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  output_format TEXT DEFAULT 'pdf'::text,
  recipients JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: report_schedules_tenant_id_fkey
-- ALTER TABLE report_schedules ADD CONSTRAINT report_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: report_schedules_saved_report_id_fkey
-- ALTER TABLE report_schedules ADD CONSTRAINT report_schedules_saved_report_id_fkey FOREIGN KEY (saved_report_id) REFERENCES user_saved_reports(id);


-- Table: retention_deletion_attempts
CREATE TABLE IF NOT EXISTS retention_deletion_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  client_id UUID,
  client_name TEXT,
  retention_expires_at DATE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  PRIMARY KEY (id)
);

-- FK: retention_deletion_attempts_tenant_id_fkey
-- ALTER TABLE retention_deletion_attempts ADD CONSTRAINT retention_deletion_attempts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: retention_deletion_attempts_client_id_fkey
-- ALTER TABLE retention_deletion_attempts ADD CONSTRAINT retention_deletion_attempts_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);


-- Table: return_confirmation_tokens
CREATE TABLE IF NOT EXISTS return_confirmation_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  return_id UUID NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: return_confirmation_tokens_tenant_id_fkey
-- ALTER TABLE return_confirmation_tokens ADD CONSTRAINT return_confirmation_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: return_confirmation_tokens_return_id_fkey
-- ALTER TABLE return_confirmation_tokens ADD CONSTRAINT return_confirmation_tokens_return_id_fkey FOREIGN KEY (return_id) REFERENCES return_reminders(id);

-- FK: return_confirmation_tokens_tenant_fk
-- ALTER TABLE return_confirmation_tokens ADD CONSTRAINT return_confirmation_tokens_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX return_confirmation_tokens_token_key ON public.return_confirmation_tokens USING btree (token);


-- Table: return_reminders
CREATE TABLE IF NOT EXISTS return_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  medical_record_id UUID,
  appointment_id UUID,
  client_id UUID NOT NULL,
  professional_id UUID,
  service_id UUID,
  return_days INTEGER NOT NULL,
  return_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  scheduled_appointment_id UUID,
  notify_patient BOOLEAN NOT NULL DEFAULT true,
  notify_days_before INTEGER DEFAULT 3,
  last_notification_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0,
  preferred_contact TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: return_reminders_tenant_id_fkey
-- ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: return_reminders_medical_record_id_fkey
-- ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES medical_records(id);

-- FK: return_reminders_appointment_id_fkey
-- ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: return_reminders_client_id_fkey
-- ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: return_reminders_professional_id_fkey
-- ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: return_reminders_service_id_fkey
-- ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_service_id_fkey FOREIGN KEY (service_id) REFERENCES procedures(id);

-- FK: return_reminders_scheduled_appointment_id_fkey
-- ALTER TABLE return_reminders ADD CONSTRAINT return_reminders_scheduled_appointment_id_fkey FOREIGN KEY (scheduled_appointment_id) REFERENCES appointments(id);


-- Table: ripd_reports
CREATE TABLE IF NOT EXISTS ripd_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  version VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL DEFAULT 'Relatório de Impacto à Proteção de Dados Pessoais'::character varying,
  identificacao_agentes JSONB NOT NULL DEFAULT '{}'::jsonb,
  necessidade_proporcionalidade JSONB NOT NULL DEFAULT '{}'::jsonb,
  identificacao_riscos JSONB NOT NULL DEFAULT '{}'::jsonb,
  medidas_salvaguardas JSONB NOT NULL DEFAULT '{}'::jsonb,
  dados_pessoais_tratados JSONB DEFAULT '[]'::jsonb,
  bases_legais JSONB DEFAULT '[]'::jsonb,
  finalidades JSONB DEFAULT '[]'::jsonb,
  riscos_identificados JSONB DEFAULT '[]'::jsonb,
  matriz_riscos JSONB DEFAULT '{}'::jsonb,
  medidas_tecnicas JSONB DEFAULT '[]'::jsonb,
  medidas_administrativas JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'draft'::character varying,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  next_review_at DATE,
  review_notes TEXT,
  pdf_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: ripd_reports_tenant_id_fkey
-- ALTER TABLE ripd_reports ADD CONSTRAINT ripd_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: rnds_certificates
CREATE TABLE IF NOT EXISTS rnds_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  certificate_data TEXT NOT NULL,
  password_hash TEXT,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: rnds_certificates_tenant_id_fkey
-- ALTER TABLE rnds_certificates ADD CONSTRAINT rnds_certificates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: rnds_incoming_statistics
CREATE TABLE IF NOT EXISTS rnds_incoming_statistics (
  tenant_id UUID,
  total_received BIGINT,
  pending_count BIGINT,
  accepted_count BIGINT,
  rejected_count BIGINT,
  merged_count BIGINT,
  error_count BIGINT,
  last_received_at TIMESTAMPTZ
);


-- Table: rnds_submissions
CREATE TABLE IF NOT EXISTS rnds_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  fhir_bundle TEXT,
  status TEXT DEFAULT 'pending'::text,
  response TEXT,
  rnds_id TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: rnds_submissions_tenant_id_fkey
-- ALTER TABLE rnds_submissions ADD CONSTRAINT rnds_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_rnds_submissions_tenant ON public.rnds_submissions USING btree (tenant_id);


-- Table: rnds_tokens
CREATE TABLE IF NOT EXISTS rnds_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  access_token TEXT,
  token_type TEXT DEFAULT 'Bearer'::text,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: rnds_tokens_tenant_id_fkey
-- ALTER TABLE rnds_tokens ADD CONSTRAINT rnds_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX rnds_tokens_tenant_id_key ON public.rnds_tokens USING btree (tenant_id);


-- Table: role_templates
CREATE TABLE IF NOT EXISTS role_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  professional_type PROFESSIONAL_TYPE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: role_templates_tenant_id_fkey
-- ALTER TABLE role_templates ADD CONSTRAINT role_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX role_templates_tenant_id_professional_type_key ON public.role_templates USING btree (tenant_id, professional_type);


-- Table: room_occupancies
CREATE TABLE IF NOT EXISTS room_occupancies (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  room_id UUID NOT NULL,
  appointment_id UUID,
  professional_id UUID,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'occupied'::text,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  PRIMARY KEY (id)
);

-- FK: room_occupancies_tenant_id_fkey
-- ALTER TABLE room_occupancies ADD CONSTRAINT room_occupancies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: room_occupancies_room_id_fkey
-- ALTER TABLE room_occupancies ADD CONSTRAINT room_occupancies_room_id_fkey FOREIGN KEY (room_id) REFERENCES clinic_rooms(id);

-- FK: room_occupancies_appointment_id_fkey
-- ALTER TABLE room_occupancies ADD CONSTRAINT room_occupancies_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: room_occupancies_professional_id_fkey
-- ALTER TABLE room_occupancies ADD CONSTRAINT room_occupancies_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);


-- Table: rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: rooms_tenant_id_fkey
-- ALTER TABLE rooms ADD CONSTRAINT rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_rooms_tenant_id ON public.rooms USING btree (tenant_id);


-- Table: rpc_rate_limits
CREATE TABLE IF NOT EXISTS rpc_rate_limits (
  user_id UUID NOT NULL,
  rpc_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute'::text, now()),
  call_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, rpc_name, window_start)
);


-- Table: salary_payments
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reference_month DATE NOT NULL,
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: salary_payments_tenant_id_fkey
-- ALTER TABLE salary_payments ADD CONSTRAINT salary_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: salary_payments_professional_id_fkey
-- ALTER TABLE salary_payments ADD CONSTRAINT salary_payments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_salary_payments_date ON public.salary_payments USING btree (payment_date);

CREATE INDEX idx_salary_payments_professional ON public.salary_payments USING btree (professional_id);

CREATE INDEX idx_salary_payments_status ON public.salary_payments USING btree (status);

CREATE INDEX idx_salary_payments_tenant ON public.salary_payments USING btree (tenant_id);


-- Table: sales_chatbot_conversations
CREATE TABLE IF NOT EXISTS sales_chatbot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_clinic_size INTEGER,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_human_takeover BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX sales_chatbot_conversations_phone_key ON public.sales_chatbot_conversations USING btree (phone);


-- Table: sales_chatbot_messages
CREATE TABLE IF NOT EXISTS sales_chatbot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  direction TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sales_chatbot_messages_conversation_id_fkey
-- ALTER TABLE sales_chatbot_messages ADD CONSTRAINT sales_chatbot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES sales_chatbot_conversations(id);


-- Table: sales_leads
CREATE TABLE IF NOT EXISTS sales_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  phone TEXT,
  email TEXT,
  name TEXT,
  clinic_size INTEGER,
  source TEXT NOT NULL DEFAULT 'whatsapp'::text,
  status TEXT NOT NULL DEFAULT 'new'::text,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX sales_leads_phone_key ON public.sales_leads USING btree (phone);


-- Table: sbis_documentation
CREATE TABLE IF NOT EXISTS sbis_documentation (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  requirement_code VARCHAR(20),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  content TEXT,
  evidence_type VARCHAR(50),
  evidence_url TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,
  compliance_status VARCHAR(20) DEFAULT 'pending'::character varying,
  compliance_notes TEXT,
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sbis_documentation_tenant_id_fkey
-- ALTER TABLE sbis_documentation ADD CONSTRAINT sbis_documentation_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: schedule_blocks
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: schedule_blocks_tenant_id_fkey
-- ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: schedule_blocks_professional_id_fkey
-- ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

CREATE INDEX idx_sb_prof_range ON public.schedule_blocks USING btree (professional_id, start_at, end_at);

CREATE INDEX idx_sb_tenant_range ON public.schedule_blocks USING btree (tenant_id, start_at, end_at);

CREATE INDEX idx_schedule_blocks_professional ON public.schedule_blocks USING btree (professional_id);


-- Table: services
CREATE TABLE IF NOT EXISTS services (
  id UUID,
  tenant_id UUID,
  name TEXT,
  description TEXT,
  duration_minutes INTEGER,
  price NUMERIC(10,2),
  cost NUMERIC(10,2),
  commission_type COMMISSION_TYPE,
  commission_value NUMERIC(10,2),
  category TEXT,
  tuss_code TEXT,
  is_active BOOLEAN,
  requires_authorization BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);


-- Table: sngpc_agendamentos
CREATE TABLE IF NOT EXISTS sngpc_agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ativo BOOLEAN DEFAULT true,
  frequencia VARCHAR(20) NOT NULL DEFAULT 'semanal'::character varying,
  dia_semana INTEGER,
  dia_mes INTEGER,
  hora_execucao TIME DEFAULT '23:00:00'::time without time zone,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  ultima_transmissao_id UUID,
  notificar_sucesso BOOLEAN DEFAULT true,
  notificar_erro BOOLEAN DEFAULT true,
  emails_notificacao TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sngpc_agendamentos_tenant_id_fkey
-- ALTER TABLE sngpc_agendamentos ADD CONSTRAINT sngpc_agendamentos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: sngpc_agendamentos_ultima_transmissao_id_fkey
-- ALTER TABLE sngpc_agendamentos ADD CONSTRAINT sngpc_agendamentos_ultima_transmissao_id_fkey FOREIGN KEY (ultima_transmissao_id) REFERENCES sngpc_transmissoes(id);

CREATE UNIQUE INDEX sngpc_agendamentos_tenant_id_key ON public.sngpc_agendamentos USING btree (tenant_id);


-- Table: sngpc_credenciais
CREATE TABLE IF NOT EXISTS sngpc_credenciais (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  username_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  cnpj VARCHAR(18) NOT NULL,
  razao_social VARCHAR(200),
  cpf_responsavel VARCHAR(14) NOT NULL,
  nome_responsavel VARCHAR(200) NOT NULL,
  crf_responsavel VARCHAR(20),
  email_notificacao VARCHAR(200),
  ativo BOOLEAN DEFAULT true,
  ultima_autenticacao TIMESTAMPTZ,
  token_expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  PRIMARY KEY (id)
);

-- FK: sngpc_credenciais_tenant_id_fkey
-- ALTER TABLE sngpc_credenciais ADD CONSTRAINT sngpc_credenciais_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX sngpc_credenciais_tenant_id_key ON public.sngpc_credenciais USING btree (tenant_id);


-- Table: sngpc_estoque
CREATE TABLE IF NOT EXISTS sngpc_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID,
  substance_name TEXT NOT NULL,
  quantity NUMERIC(10,4) NOT NULL,
  unit TEXT DEFAULT 'comprimido'::text,
  batch_number TEXT,
  expiry_date DATE,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sngpc_estoque_tenant_id_fkey
-- ALTER TABLE sngpc_estoque ADD CONSTRAINT sngpc_estoque_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: sngpc_estoque_product_id_fkey
-- ALTER TABLE sngpc_estoque ADD CONSTRAINT sngpc_estoque_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);

CREATE INDEX idx_sngpc_estoque_tenant ON public.sngpc_estoque USING btree (tenant_id);


-- Table: sngpc_movimentacoes
CREATE TABLE IF NOT EXISTS sngpc_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  estoque_id UUID,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(10,4) NOT NULL,
  prescription_id UUID,
  patient_id UUID,
  professional_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sngpc_movimentacoes_tenant_id_fkey
-- ALTER TABLE sngpc_movimentacoes ADD CONSTRAINT sngpc_movimentacoes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: sngpc_movimentacoes_estoque_id_fkey
-- ALTER TABLE sngpc_movimentacoes ADD CONSTRAINT sngpc_movimentacoes_estoque_id_fkey FOREIGN KEY (estoque_id) REFERENCES sngpc_estoque(id);

-- FK: sngpc_movimentacoes_patient_id_fkey
-- ALTER TABLE sngpc_movimentacoes ADD CONSTRAINT sngpc_movimentacoes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);


-- Table: sngpc_notificacoes_receita
CREATE TABLE IF NOT EXISTS sngpc_notificacoes_receita (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  numero TEXT NOT NULL,
  serie TEXT NOT NULL,
  tipo_receituario TEXT NOT NULL,
  lista TEXT NOT NULL,
  medicamento_codigo TEXT NOT NULL,
  medicamento_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  posologia TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL,
  paciente_id UUID,
  paciente_nome TEXT NOT NULL,
  paciente_endereco TEXT NOT NULL,
  paciente_cidade TEXT NOT NULL,
  paciente_uf TEXT NOT NULL,
  paciente_cpf TEXT,
  prescriptor_id UUID,
  prescriptor_nome TEXT NOT NULL,
  prescriptor_crm TEXT NOT NULL,
  prescriptor_uf TEXT NOT NULL,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'EMITIDA'::text,
  data_dispensacao DATE,
  movimentacao_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sngpc_notificacoes_receita_tenant_id_fkey
-- ALTER TABLE sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: sngpc_notificacoes_receita_paciente_id_fkey
-- ALTER TABLE sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES patients(id);

-- FK: sngpc_notificacoes_receita_prescriptor_id_fkey
-- ALTER TABLE sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_prescriptor_id_fkey FOREIGN KEY (prescriptor_id) REFERENCES profiles(id);

-- FK: sngpc_notificacoes_receita_movimentacao_id_fkey
-- ALTER TABLE sngpc_notificacoes_receita ADD CONSTRAINT sngpc_notificacoes_receita_movimentacao_id_fkey FOREIGN KEY (movimentacao_id) REFERENCES sngpc_movimentacoes(id);

CREATE UNIQUE INDEX sngpc_notificacoes_receita_tenant_id_numero_serie_key ON public.sngpc_notificacoes_receita USING btree (tenant_id, numero, serie);


-- Table: sngpc_sequencial
CREATE TABLE IF NOT EXISTS sngpc_sequencial (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tipo_receituario TEXT NOT NULL,
  ano INTEGER NOT NULL,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sngpc_sequencial_tenant_id_fkey
-- ALTER TABLE sngpc_sequencial ADD CONSTRAINT sngpc_sequencial_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX sngpc_sequencial_tenant_id_tipo_receituario_ano_key ON public.sngpc_sequencial USING btree (tenant_id, tipo_receituario, ano);


-- Table: sngpc_tracked_prescriptions
CREATE TABLE IF NOT EXISTS sngpc_tracked_prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  prescription_id UUID,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  anvisa_lista TEXT NOT NULL,
  recipe_type TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  medication_dosage TEXT,
  medication_quantity TEXT,
  medication_duration_days INTEGER,
  dispensed_at TIMESTAMPTZ,
  dispensed_by TEXT,
  dispensed_pharmacy TEXT,
  dispensation_status TEXT NOT NULL DEFAULT 'pendente'::text,
  sngpc_notified BOOLEAN DEFAULT false,
  sngpc_notification_date TIMESTAMPTZ,
  sngpc_protocol TEXT,
  prescribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sngpc_tracked_prescriptions_tenant_id_fkey
-- ALTER TABLE sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: sngpc_tracked_prescriptions_prescription_id_fkey
-- ALTER TABLE sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id);

-- FK: sngpc_tracked_prescriptions_patient_id_fkey
-- ALTER TABLE sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: sngpc_tracked_prescriptions_professional_id_fkey
-- ALTER TABLE sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);


-- Table: sngpc_transmissoes
CREATE TABLE IF NOT EXISTS sngpc_transmissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  xml_content TEXT,
  response TEXT,
  transmitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: sngpc_transmissoes_tenant_id_fkey
-- ALTER TABLE sngpc_transmissoes ADD CONSTRAINT sngpc_transmissoes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: sngpc_transmissoes_log
CREATE TABLE IF NOT EXISTS sngpc_transmissoes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  transmissao_id UUID NOT NULL,
  acao VARCHAR(50) NOT NULL,
  status_anterior SNGPC_TRANSMISSAO_STATUS,
  status_novo SNGPC_TRANSMISSAO_STATUS,
  request_payload JSONB,
  response_payload JSONB,
  http_status INTEGER,
  erro_mensagem TEXT,
  executado_por UUID,
  executado_em TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  PRIMARY KEY (id)
);

-- FK: sngpc_transmissoes_log_transmissao_id_fkey
-- ALTER TABLE sngpc_transmissoes_log ADD CONSTRAINT sngpc_transmissoes_log_transmissao_id_fkey FOREIGN KEY (transmissao_id) REFERENCES sngpc_transmissoes(id);


-- Table: specialties
CREATE TABLE IF NOT EXISTS specialties (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: specialties_tenant_id_fkey
-- ALTER TABLE specialties ADD CONSTRAINT specialties_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_specialties_tenant_id ON public.specialties USING btree (tenant_id);


-- Table: split_payment_logs
CREATE TABLE IF NOT EXISTS split_payment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  charge_id TEXT NOT NULL,
  provider PAYMENT_GATEWAY_PROVIDER NOT NULL,
  professional_id UUID,
  total_amount NUMERIC(12,2) NOT NULL,
  split_amount NUMERIC(12,2) NOT NULL,
  clinic_amount NUMERIC(12,2) NOT NULL,
  fee_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  error_message TEXT,
  webhook_received_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: split_payment_logs_tenant_id_fkey
-- ALTER TABLE split_payment_logs ADD CONSTRAINT split_payment_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: split_payment_logs_appointment_id_fkey
-- ALTER TABLE split_payment_logs ADD CONSTRAINT split_payment_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: split_payment_logs_professional_id_fkey
-- ALTER TABLE split_payment_logs ADD CONSTRAINT split_payment_logs_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(user_id);


-- Table: stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  reason TEXT,
  created_by UUID,
  batch_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  out_reason_type TEXT,
  PRIMARY KEY (id)
);

-- FK: stock_movements_tenant_id_fkey
-- ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: stock_movements_product_id_fkey
-- ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);

CREATE INDEX idx_stock_movements_batch ON public.stock_movements USING btree (batch_number) WHERE (batch_number IS NOT NULL);

CREATE INDEX idx_stock_movements_product ON public.stock_movements USING btree (product_id);

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);

CREATE INDEX idx_stock_movements_tenant_created_at ON public.stock_movements USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_stock_movements_tenant_id ON public.stock_movements USING btree (tenant_id);

CREATE INDEX idx_stock_movements_tenant_product_created_at ON public.stock_movements USING btree (tenant_id, product_id, created_at DESC);


-- Table: stripe_webhook_events
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_stripe_events_type ON public.stripe_webhook_events USING btree (event_type);


-- Table: subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing'::text,
  plan TEXT,
  trial_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end TIMESTAMPTZ NOT NULL DEFAULT (now() + '7 days'::interval),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  team_limit INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: subscriptions_tenant_id_fkey
-- ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_subscriptions_asaas_customer_id ON public.subscriptions USING btree (asaas_customer_id);

CREATE INDEX idx_subscriptions_asaas_subscription_id ON public.subscriptions USING btree (asaas_subscription_id);

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);

CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions USING btree (stripe_customer_id);

CREATE INDEX idx_subscriptions_tenant_id ON public.subscriptions USING btree (tenant_id);

CREATE UNIQUE INDEX subscriptions_tenant_id_key ON public.subscriptions USING btree (tenant_id);


-- Table: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: suppliers_tenant_id_fkey
-- ALTER TABLE suppliers ADD CONSTRAINT suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_suppliers_tenant_id ON public.suppliers USING btree (tenant_id);

CREATE INDEX idx_suppliers_tenant_name ON public.suppliers USING btree (tenant_id, name);


-- Table: support_messages
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT DEFAULT 'user'::text,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: support_messages_ticket_id_fkey
-- ALTER TABLE support_messages ADD CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id);

CREATE INDEX support_messages_ticket_id_idx ON public.support_messages USING btree (ticket_id, created_at);


-- Table: support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal'::text,
  status TEXT DEFAULT 'open'::text,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: support_tickets_tenant_id_fkey
-- ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_support_tickets_tenant ON public.support_tickets USING btree (tenant_id);

CREATE INDEX support_tickets_tenant_id_idx ON public.support_tickets USING btree (tenant_id);


-- Table: tenant_feature_overrides
CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  enabled_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: tenant_feature_overrides_tenant_id_fkey
-- ALTER TABLE tenant_feature_overrides ADD CONSTRAINT tenant_feature_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: tenant_feature_overrides_enabled_by_fkey
-- ALTER TABLE tenant_feature_overrides ADD CONSTRAINT tenant_feature_overrides_enabled_by_fkey FOREIGN KEY (enabled_by) REFERENCES profiles(id);

CREATE UNIQUE INDEX tenant_feature_overrides_tenant_id_feature_key_key ON public.tenant_feature_overrides USING btree (tenant_id, feature_key);


-- Table: tenant_limit_overrides
CREATE TABLE IF NOT EXISTS tenant_limit_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  limit_key TEXT NOT NULL,
  custom_value INTEGER NOT NULL,
  reason TEXT,
  enabled_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: tenant_limit_overrides_tenant_id_fkey
-- ALTER TABLE tenant_limit_overrides ADD CONSTRAINT tenant_limit_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: tenant_limit_overrides_enabled_by_fkey
-- ALTER TABLE tenant_limit_overrides ADD CONSTRAINT tenant_limit_overrides_enabled_by_fkey FOREIGN KEY (enabled_by) REFERENCES profiles(id);

CREATE UNIQUE INDEX tenant_limit_overrides_tenant_id_limit_key_key ON public.tenant_limit_overrides USING btree (tenant_id, limit_key);


-- Table: tenant_payment_gateways
CREATE TABLE IF NOT EXISTS tenant_payment_gateways (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider PAYMENT_GATEWAY_PROVIDER NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  webhook_secret_encrypted TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox'::text,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_split_enabled BOOLEAN NOT NULL DEFAULT false,
  split_fee_payer TEXT DEFAULT 'clinic'::text,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_validated_at TIMESTAMPTZ,
  validation_status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: tenant_payment_gateways_tenant_id_fkey
-- ALTER TABLE tenant_payment_gateways ADD CONSTRAINT tenant_payment_gateways_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX tenant_payment_gateways_tenant_id_provider_key ON public.tenant_payment_gateways USING btree (tenant_id, provider);


-- Table: tenant_sequences
CREATE TABLE IF NOT EXISTS tenant_sequences (
  tenant_id UUID NOT NULL,
  attendance_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id)
);

-- FK: tenant_sequences_tenant_id_fkey
-- ALTER TABLE tenant_sequences ADD CONSTRAINT tenant_sequences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: tenant_theme_settings
CREATE TABLE IF NOT EXISTS tenant_theme_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  primary_h INTEGER DEFAULT 174,
  primary_s INTEGER DEFAULT 72,
  primary_l INTEGER DEFAULT 38,
  accent_h INTEGER DEFAULT 210,
  accent_s INTEGER DEFAULT 80,
  accent_l INTEGER DEFAULT 55,
  preset_name TEXT DEFAULT 'teal'::text,
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  border_radius TEXT DEFAULT '1rem'::text,
  font_family TEXT DEFAULT 'default'::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: tenant_theme_settings_tenant_id_fkey
-- ALTER TABLE tenant_theme_settings ADD CONSTRAINT tenant_theme_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX tenant_theme_settings_tenant_id_key ON public.tenant_theme_settings USING btree (tenant_id);


-- Table: tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  cnpj TEXT,
  cpf TEXT,
  logo_url TEXT,
  website TEXT,
  whatsapp_api_url TEXT,
  whatsapp_api_key TEXT,
  whatsapp_instance TEXT,
  enabled_modules TEXT[] DEFAULT '{}'::text[],
  simple_mode BOOLEAN DEFAULT false,
  reply_to_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nfeio_active BOOLEAN DEFAULT false,
  nfeio_api_key TEXT,
  nfeio_auto_emit BOOLEAN DEFAULT false,
  nfeio_certificate_expires TIMESTAMPTZ,
  nfeio_company_id TEXT,
  nfeio_default_service_code TEXT DEFAULT '4.03'::text,
  billing_cpf_cnpj TEXT,
  cashback_enabled BOOLEAN NOT NULL DEFAULT false,
  default_commission_percent NUMERIC(5,2) DEFAULT 10,
  email_reply_to TEXT,
  gamification_enabled BOOLEAN DEFAULT true,
  online_booking_enabled BOOLEAN NOT NULL DEFAULT false,
  patient_booking_enabled BOOLEAN NOT NULL DEFAULT false,
  patient_payment_enabled BOOLEAN NOT NULL DEFAULT false,
  points_enabled BOOLEAN DEFAULT false,
  retention_years INTEGER NOT NULL DEFAULT 20,
  rnds_enabled BOOLEAN DEFAULT false,
  show_clinic_average_to_staff BOOLEAN NOT NULL DEFAULT false,
  smart_confirmation_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_provider TEXT DEFAULT 'zenvia'::text,
  stone_api_key TEXT,
  autonomous_config JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

CREATE INDEX idx_tenants_billing_cpf_cnpj ON public.tenants USING btree (billing_cpf_cnpj);

CREATE INDEX idx_tenants_email ON public.tenants USING btree (email);


-- Table: tiss_glosa_appeals
CREATE TABLE IF NOT EXISTS tiss_glosa_appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tiss_guide_id UUID NOT NULL,
  appeal_number TEXT NOT NULL,
  justification TEXT NOT NULL,
  requested_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  response_text TEXT,
  resolved_value NUMERIC(12,2),
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: tiss_glosa_appeals_tenant_id_fkey
-- ALTER TABLE tiss_glosa_appeals ADD CONSTRAINT tiss_glosa_appeals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: tiss_glosa_appeals_tiss_guide_id_fkey
-- ALTER TABLE tiss_glosa_appeals ADD CONSTRAINT tiss_glosa_appeals_tiss_guide_id_fkey FOREIGN KEY (tiss_guide_id) REFERENCES tiss_guides(id);


-- Table: tiss_guides
CREATE TABLE IF NOT EXISTS tiss_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  insurance_plan_id UUID,
  appointment_id UUID,
  lot_number TEXT NOT NULL,
  guide_number TEXT NOT NULL,
  guide_type TEXT NOT NULL DEFAULT 'consulta'::text,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  xml_content TEXT,
  tiss_version TEXT NOT NULL DEFAULT '3.05.00'::text,
  submitted_at TIMESTAMPTZ,
  response_code TEXT,
  response_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  glosa_code TEXT,
  PRIMARY KEY (id)
);

-- FK: tiss_guides_tenant_id_fkey
-- ALTER TABLE tiss_guides ADD CONSTRAINT tiss_guides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: tiss_guides_insurance_plan_id_fkey
-- ALTER TABLE tiss_guides ADD CONSTRAINT tiss_guides_insurance_plan_id_fkey FOREIGN KEY (insurance_plan_id) REFERENCES insurance_plans(id);

-- FK: tiss_guides_appointment_id_fkey
-- ALTER TABLE tiss_guides ADD CONSTRAINT tiss_guides_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);


-- Table: transcription_jobs
CREATE TABLE IF NOT EXISTS transcription_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'processing'::text,
  audio_url TEXT,
  result_text TEXT,
  duration_ms INTEGER,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  job_name TEXT NOT NULL,
  s3_uri TEXT NOT NULL,
  transcript TEXT,
  PRIMARY KEY (id)
);

-- FK: transcription_jobs_tenant_id_fkey
-- ALTER TABLE transcription_jobs ADD CONSTRAINT transcription_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX transcription_jobs_job_name_key ON public.transcription_jobs USING btree (job_name);


-- Table: treatment_plan_items
CREATE TABLE IF NOT EXISTS treatment_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tooth_number INTEGER,
  surface TEXT,
  procedure_name TEXT NOT NULL,
  procedure_code TEXT,
  cost NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'planned'::text,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  appointment_id UUID,
  completed_by UUID,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  odontogram_tooth_id UUID,
  procedure_category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  region TEXT,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: treatment_plan_items_plan_id_fkey
-- ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES treatment_plans(id);

-- FK: treatment_plan_items_tenant_id_fkey
-- ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: treatment_plan_items_appointment_id_fkey
-- ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: treatment_plan_items_completed_by_fkey
-- ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES profiles(id);

-- FK: treatment_plan_items_odontogram_tooth_id_fkey
-- ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_odontogram_tooth_id_fkey FOREIGN KEY (odontogram_tooth_id) REFERENCES odontogram_teeth(id);


-- Table: treatment_plans
CREATE TABLE IF NOT EXISTS treatment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'proposed'::text,
  total_cost NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by_client BOOLEAN DEFAULT false,
  client_id UUID NOT NULL,
  client_signature TEXT,
  description TEXT,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_value NUMERIC(12,2) DEFAULT 0,
  final_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  installments INTEGER DEFAULT 1,
  odontogram_id UUID,
  signature_ip TEXT,
  PRIMARY KEY (id)
);

-- FK: treatment_plans_tenant_id_fkey
-- ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: treatment_plans_patient_id_fkey
-- ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: treatment_plans_professional_id_fkey
-- ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: treatment_plans_client_id_fkey
-- ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: treatment_plans_odontogram_id_fkey
-- ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_odontogram_id_fkey FOREIGN KEY (odontogram_id) REFERENCES odontograms(id);

CREATE INDEX idx_treatment_plans_patient ON public.treatment_plans USING btree (patient_id);


-- Table: triage_records
CREATE TABLE IF NOT EXISTS triage_records (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  priority TEXT NOT NULL DEFAULT 'green'::text,
  chief_complaint TEXT,
  vital_signs JSONB,
  notes TEXT,
  classification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  allergies TEXT,
  appointment_id UUID,
  blood_pressure_diastolic INTEGER,
  blood_pressure_systolic INTEGER,
  client_id UUID NOT NULL,
  current_medications TEXT,
  heart_rate INTEGER,
  height_cm INTEGER,
  medical_history TEXT,
  oxygen_saturation NUMERIC(5,1),
  pain_scale INTEGER,
  performed_by UUID,
  respiratory_rate INTEGER,
  status TEXT NOT NULL DEFAULT 'pendente'::text,
  temperature NUMERIC(4,1),
  triaged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg NUMERIC(5,1),
  PRIMARY KEY (id)
);

-- FK: triage_records_tenant_id_fkey
-- ALTER TABLE triage_records ADD CONSTRAINT triage_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: triage_records_patient_id_fkey
-- ALTER TABLE triage_records ADD CONSTRAINT triage_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: triage_records_professional_id_fkey
-- ALTER TABLE triage_records ADD CONSTRAINT triage_records_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: triage_records_appointment_id_fkey
-- ALTER TABLE triage_records ADD CONSTRAINT triage_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: triage_records_client_id_fkey
-- ALTER TABLE triage_records ADD CONSTRAINT triage_records_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: triage_records_performed_by_fkey
-- ALTER TABLE triage_records ADD CONSTRAINT triage_records_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES profiles(id);

CREATE INDEX idx_triage_records_patient_id ON public.triage_records USING btree (patient_id);

CREATE INDEX idx_triage_records_tenant_id ON public.triage_records USING btree (tenant_id);


-- Table: tsa_config
CREATE TABLE IF NOT EXISTS tsa_config (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TSA_PROVIDER NOT NULL DEFAULT 'certisign'::tsa_provider,
  api_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  certificate_path TEXT,
  certificate_password_encrypted TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256'::character varying,
  policy_oid VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  last_test_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  PRIMARY KEY (id)
);

-- FK: tsa_config_tenant_id_fkey
-- ALTER TABLE tsa_config ADD CONSTRAINT tsa_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX tsa_config_tenant_id_key ON public.tsa_config USING btree (tenant_id);


-- Table: tsa_timestamps
CREATE TABLE IF NOT EXISTS tsa_timestamps (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_type TSA_DOCUMENT_TYPE NOT NULL,
  document_id UUID NOT NULL,
  document_table VARCHAR(100) NOT NULL,
  document_hash TEXT NOT NULL,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256'::character varying,
  status TSA_STATUS NOT NULL DEFAULT 'pending'::tsa_status,
  timestamp_token BYTEA,
  timestamp_token_base64 TEXT,
  serial_number VARCHAR(100),
  tsa_time TIMESTAMPTZ,
  tsa_policy_oid VARCHAR(100),
  tsa_provider TSA_PROVIDER,
  tsa_response JSONB,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  PRIMARY KEY (id)
);

-- FK: tsa_timestamps_tenant_id_fkey
-- ALTER TABLE tsa_timestamps ADD CONSTRAINT tsa_timestamps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);


-- Table: tuss_odonto_prices
CREATE TABLE IF NOT EXISTS tuss_odonto_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tuss_code TEXT NOT NULL,
  description TEXT NOT NULL,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: tuss_odonto_prices_tenant_id_fkey
-- ALTER TABLE tuss_odonto_prices ADD CONSTRAINT tuss_odonto_prices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE UNIQUE INDEX tuss_odonto_prices_tenant_id_tuss_code_key ON public.tuss_odonto_prices USING btree (tenant_id, tuss_code);


-- Table: user_keyboard_shortcuts
CREATE TABLE IF NOT EXISTS user_keyboard_shortcuts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_id TEXT NOT NULL,
  keys TEXT[] NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX user_keyboard_shortcuts_user_id_action_id_key ON public.user_keyboard_shortcuts USING btree (user_id, action_id);


-- Table: user_notification_preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  appointment_cancelled BOOLEAN NOT NULL DEFAULT true,
  appointment_completed BOOLEAN NOT NULL DEFAULT true,
  appointment_created BOOLEAN NOT NULL DEFAULT true,
  commission_generated BOOLEAN NOT NULL DEFAULT true,
  commission_paid BOOLEAN NOT NULL DEFAULT true,
  goal_approved BOOLEAN NOT NULL DEFAULT true,
  goal_reached BOOLEAN NOT NULL DEFAULT true,
  goal_rejected BOOLEAN NOT NULL DEFAULT true,
  goal_reminder BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (id)
);

-- FK: user_notification_preferences_tenant_id_fkey
-- ALTER TABLE user_notification_preferences ADD CONSTRAINT user_notification_preferences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_notification_prefs_user ON public.user_notification_preferences USING btree (user_id);

CREATE INDEX idx_user_notif_prefs_user ON public.user_notification_preferences USING btree (user_id);

CREATE UNIQUE INDEX user_notification_preferences_user_id_key ON public.user_notification_preferences USING btree (user_id);


-- Table: user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role APP_ROLE NOT NULL DEFAULT 'staff'::app_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: user_roles_tenant_id_fkey
-- ALTER TABLE user_roles ADD CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_user_roles_tenant_id ON public.user_roles USING btree (tenant_id);

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);

CREATE UNIQUE INDEX user_roles_user_id_tenant_id_key ON public.user_roles USING btree (user_id, tenant_id);


-- Table: user_saved_reports
CREATE TABLE IF NOT EXISTS user_saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  report_definition_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  custom_filters JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB,
  custom_group_by JSONB,
  custom_chart_config JSONB,
  is_favorite BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: user_saved_reports_tenant_id_fkey
-- ALTER TABLE user_saved_reports ADD CONSTRAINT user_saved_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: user_saved_reports_report_definition_id_fkey
-- ALTER TABLE user_saved_reports ADD CONSTRAINT user_saved_reports_report_definition_id_fkey FOREIGN KEY (report_definition_id) REFERENCES report_definitions(id);


-- Table: user_tour_progress
CREATE TABLE IF NOT EXISTS user_tour_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  tour_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  step_index INTEGER NOT NULL DEFAULT 0,
  tour_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: user_tour_progress_tenant_id_fkey
-- ALTER TABLE user_tour_progress ADD CONSTRAINT user_tour_progress_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE INDEX idx_user_tour_progress_tenant ON public.user_tour_progress USING btree (tenant_id, tour_key, updated_at DESC);

CREATE INDEX idx_user_tour_progress_user ON public.user_tour_progress USING btree (user_id);

CREATE UNIQUE INDEX user_tour_progress_user_id_tour_id_key ON public.user_tour_progress USING btree (user_id, tour_id);


-- Table: user_video_progress
CREATE TABLE IF NOT EXISTS user_video_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  video_id UUID NOT NULL,
  watched_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: user_video_progress_video_id_fkey
-- ALTER TABLE user_video_progress ADD CONSTRAINT user_video_progress_video_id_fkey FOREIGN KEY (video_id) REFERENCES video_tutorials(id);

CREATE UNIQUE INDEX user_video_progress_user_id_video_id_key ON public.user_video_progress USING btree (user_id, video_id);


-- Table: video_tutorials
CREATE TABLE IF NOT EXISTS video_tutorials (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  category TEXT NOT NULL,
  feature_key TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);


-- Table: voucher_redemptions
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  discount_applied NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID,
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  redeemed_by UUID,
  PRIMARY KEY (id)
);

-- FK: voucher_redemptions_voucher_id_fkey
-- ALTER TABLE voucher_redemptions ADD CONSTRAINT voucher_redemptions_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES vouchers(id);

-- FK: voucher_redemptions_tenant_id_fkey
-- ALTER TABLE voucher_redemptions ADD CONSTRAINT voucher_redemptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: voucher_redemptions_patient_id_fkey
-- ALTER TABLE voucher_redemptions ADD CONSTRAINT voucher_redemptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: voucher_redemptions_appointment_id_fkey
-- ALTER TABLE voucher_redemptions ADD CONSTRAINT voucher_redemptions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- FK: voucher_redemptions_order_id_fkey
-- ALTER TABLE voucher_redemptions ADD CONSTRAINT voucher_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);

-- FK: voucher_redemptions_redeemed_by_fkey
-- ALTER TABLE voucher_redemptions ADD CONSTRAINT voucher_redemptions_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES profiles(id);

CREATE INDEX idx_voucher_redemptions_vid ON public.voucher_redemptions USING btree (voucher_id);


-- Table: vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo'::text,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  service_id UUID,
  PRIMARY KEY (id)
);

-- FK: vouchers_tenant_id_fkey
-- ALTER TABLE vouchers ADD CONSTRAINT vouchers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: vouchers_created_by_fkey
-- ALTER TABLE vouchers ADD CONSTRAINT vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

-- FK: vouchers_service_id_fkey
-- ALTER TABLE vouchers ADD CONSTRAINT vouchers_service_id_fkey FOREIGN KEY (service_id) REFERENCES procedures(id);

CREATE INDEX idx_vouchers_code ON public.vouchers USING btree (tenant_id, code);

CREATE INDEX idx_vouchers_status ON public.vouchers USING btree (tenant_id, status);

CREATE INDEX idx_vouchers_tenant ON public.vouchers USING btree (tenant_id);


-- Table: waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  procedure_id UUID,
  professional_id UUID,
  preferred_dates TEXT,
  priority TEXT DEFAULT 'normal'::text,
  notes TEXT,
  status TEXT DEFAULT 'waiting'::text,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  preferred_periods TEXT[],
  reason TEXT,
  scheduled_at TIMESTAMPTZ,
  service_id UUID,
  specialty_id UUID,
  PRIMARY KEY (id)
);

-- FK: waitlist_tenant_id_fkey
-- ALTER TABLE waitlist ADD CONSTRAINT waitlist_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: waitlist_patient_id_fkey
-- ALTER TABLE waitlist ADD CONSTRAINT waitlist_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);

-- FK: waitlist_procedure_id_fkey
-- ALTER TABLE waitlist ADD CONSTRAINT waitlist_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES procedures(id);

-- FK: waitlist_professional_id_fkey
-- ALTER TABLE waitlist ADD CONSTRAINT waitlist_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES profiles(id);

-- FK: waitlist_client_id_fkey
-- ALTER TABLE waitlist ADD CONSTRAINT waitlist_client_id_fkey FOREIGN KEY (client_id) REFERENCES patients(id);

-- FK: waitlist_service_id_fkey
-- ALTER TABLE waitlist ADD CONSTRAINT waitlist_service_id_fkey FOREIGN KEY (service_id) REFERENCES procedures(id);

-- FK: waitlist_specialty_id_fkey
-- ALTER TABLE waitlist ADD CONSTRAINT waitlist_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES specialties(id);

CREATE INDEX idx_waitlist_tenant_id ON public.waitlist USING btree (tenant_id);


-- Table: waitlist_notifications
CREATE TABLE IF NOT EXISTS waitlist_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  waitlist_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_date TIMESTAMPTZ NOT NULL,
  service_id UUID,
  professional_id UUID,
  period TEXT,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- FK: waitlist_notifications_tenant_id_fkey
-- ALTER TABLE waitlist_notifications ADD CONSTRAINT waitlist_notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- FK: waitlist_notifications_waitlist_id_fkey
-- ALTER TABLE waitlist_notifications ADD CONSTRAINT waitlist_notifications_waitlist_id_fkey FOREIGN KEY (waitlist_id) REFERENCES waitlist(id);

