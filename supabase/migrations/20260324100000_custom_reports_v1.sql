-- Fase 16 - Relatórios Customizáveis
-- Sistema completo de builder de relatórios com templates, filtros, agrupamentos e exportação

-- Enum para tipo de campo
CREATE TYPE report_field_type AS ENUM (
  'text', 'number', 'currency', 'date', 'datetime', 'boolean', 'percentage', 'duration'
);

-- Enum para tipo de agregação
CREATE TYPE report_aggregation AS ENUM (
  'none', 'count', 'sum', 'avg', 'min', 'max', 'count_distinct'
);

-- Enum para tipo de gráfico
CREATE TYPE report_chart_type AS ENUM (
  'none', 'line', 'bar', 'pie', 'area', 'donut', 'stacked_bar'
);

-- Enum para frequência de agendamento
CREATE TYPE report_schedule_frequency AS ENUM (
  'daily', 'weekly', 'biweekly', 'monthly'
);

-- Enum para categoria de relatório
CREATE TYPE report_category AS ENUM (
  'financeiro', 'atendimento', 'clinico', 'marketing', 'operacional', 'custom'
);

-- Tabela de definições de relatórios (templates e customizados)
CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category report_category NOT NULL DEFAULT 'custom',
  
  -- Template ou customizado
  is_template BOOLEAN DEFAULT false,
  template_id UUID REFERENCES report_definitions(id),
  
  -- Configuração de dados
  base_table VARCHAR(100) NOT NULL,
  joins JSONB DEFAULT '[]',
  
  -- Campos selecionados
  fields JSONB NOT NULL DEFAULT '[]',
  
  -- Filtros padrão
  default_filters JSONB DEFAULT '[]',
  
  -- Agrupamentos
  group_by JSONB DEFAULT '[]',
  order_by JSONB DEFAULT '[]',
  
  -- Gráfico
  chart_type report_chart_type DEFAULT 'none',
  chart_config JSONB DEFAULT '{}',
  
  -- Metadados
  icon VARCHAR(50),
  color VARCHAR(20),
  
  -- Controle
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de relatórios salvos pelo usuário
CREATE TABLE IF NOT EXISTS user_saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Referência ao relatório
  report_definition_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  
  -- Customizações do usuário
  name VARCHAR(200) NOT NULL,
  custom_filters JSONB DEFAULT '[]',
  custom_fields JSONB,
  custom_group_by JSONB,
  custom_chart_config JSONB,
  
  -- Favorito
  is_favorite BOOLEAN DEFAULT false,
  
  -- Última execução
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de agendamentos de relatórios
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Referência
  saved_report_id UUID NOT NULL REFERENCES user_saved_reports(id) ON DELETE CASCADE,
  
  -- Configuração de agendamento
  frequency report_schedule_frequency NOT NULL,
  day_of_week INTEGER, -- 0-6 para weekly
  day_of_month INTEGER, -- 1-31 para monthly
  time_of_day TIME DEFAULT '08:00',
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  
  -- Destinatários
  email_recipients TEXT[] NOT NULL,
  include_pdf BOOLEAN DEFAULT true,
  include_excel BOOLEAN DEFAULT false,
  include_csv BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de execuções
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Referência
  report_definition_id UUID REFERENCES report_definitions(id) ON DELETE SET NULL,
  saved_report_id UUID REFERENCES user_saved_reports(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
  
  -- Parâmetros usados
  filters_applied JSONB,
  
  -- Resultado
  row_count INTEGER,
  execution_time_ms INTEGER,
  
  -- Exportação
  export_format VARCHAR(10),
  file_url TEXT,
  file_size_bytes INTEGER,
  
  -- Status
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  
  -- Auditoria
  executed_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_report_definitions_tenant ON report_definitions(tenant_id);
CREATE INDEX idx_report_definitions_category ON report_definitions(category);
CREATE INDEX idx_report_definitions_template ON report_definitions(is_template) WHERE is_template = true;

CREATE INDEX idx_user_saved_reports_tenant ON user_saved_reports(tenant_id);
CREATE INDEX idx_user_saved_reports_user ON user_saved_reports(user_id);
CREATE INDEX idx_user_saved_reports_favorite ON user_saved_reports(user_id, is_favorite) WHERE is_favorite = true;

CREATE INDEX idx_report_schedules_tenant ON report_schedules(tenant_id);
CREATE INDEX idx_report_schedules_next ON report_schedules(next_send_at) WHERE is_active = true;

CREATE INDEX idx_report_executions_tenant ON report_executions(tenant_id);
CREATE INDEX idx_report_executions_date ON report_executions(executed_at DESC);

-- RLS
ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;

-- Policies para report_definitions
CREATE POLICY "Templates são públicos" ON report_definitions
  FOR SELECT USING (is_template = true OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant pode criar relatórios" ON report_definitions
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant pode atualizar seus relatórios" ON report_definitions
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND is_template = false);

CREATE POLICY "Tenant pode deletar seus relatórios" ON report_definitions
  FOR DELETE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND is_template = false);

-- Policies para user_saved_reports
CREATE POLICY "Usuário vê seus relatórios salvos" ON user_saved_reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Usuário pode criar relatórios salvos" ON user_saved_reports
  FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Usuário pode atualizar seus relatórios salvos" ON user_saved_reports
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Usuário pode deletar seus relatórios salvos" ON user_saved_reports
  FOR DELETE USING (user_id = auth.uid());

-- Policies para report_schedules
CREATE POLICY "Tenant isolation for report_schedules" ON report_schedules
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Policies para report_executions
CREATE POLICY "Tenant isolation for report_executions" ON report_executions
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_report_definitions_updated_at
  BEFORE UPDATE ON report_definitions
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

CREATE TRIGGER trigger_user_saved_reports_updated_at
  BEFORE UPDATE ON user_saved_reports
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

CREATE TRIGGER trigger_report_schedules_updated_at
  BEFORE UPDATE ON report_schedules
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

-- Inserir templates padrão (10 relatórios obrigatórios)
INSERT INTO report_definitions (is_template, name, description, category, base_table, fields, default_filters, group_by, chart_type, icon, color) VALUES

-- 1. Faturamento por período
(true, 'Faturamento por Período', 'Análise de faturamento com detalhamento por data, forma de pagamento e profissional', 'financeiro', 'appointments',
'[
  {"name": "data", "label": "Data", "type": "date", "source": "appointments.start_time"},
  {"name": "valor", "label": "Valor", "type": "currency", "source": "appointments.price", "aggregation": "sum"},
  {"name": "forma_pagamento", "label": "Forma Pagamento", "type": "text", "source": "appointments.payment_method"},
  {"name": "profissional", "label": "Profissional", "type": "text", "source": "profiles.full_name"}
]',
'[{"field": "start_time", "operator": "between", "label": "Período"}]',
'[{"field": "data", "interval": "day"}]',
'bar', 'DollarSign', 'green'),

-- 2. Comissões por profissional
(true, 'Comissões por Profissional', 'Relatório de comissões calculadas por profissional e serviço', 'financeiro', 'appointments',
'[
  {"name": "profissional", "label": "Profissional", "type": "text", "source": "profiles.full_name"},
  {"name": "servico", "label": "Serviço", "type": "text", "source": "services.name"},
  {"name": "atendimentos", "label": "Atendimentos", "type": "number", "aggregation": "count"},
  {"name": "valor_total", "label": "Valor Total", "type": "currency", "source": "appointments.price", "aggregation": "sum"},
  {"name": "comissao", "label": "Comissão", "type": "currency", "source": "calculated.commission", "aggregation": "sum"}
]',
'[{"field": "start_time", "operator": "between", "label": "Período"}]',
'[{"field": "profissional"}]',
'bar', 'Users', 'blue'),

-- 3. Inadimplência
(true, 'Inadimplência', 'Pacientes com pagamentos em atraso', 'financeiro', 'appointments',
'[
  {"name": "paciente", "label": "Paciente", "type": "text", "source": "clients.name"},
  {"name": "telefone", "label": "Telefone", "type": "text", "source": "clients.phone"},
  {"name": "valor", "label": "Valor Devido", "type": "currency", "source": "appointments.price"},
  {"name": "data_atendimento", "label": "Data Atendimento", "type": "date", "source": "appointments.start_time"},
  {"name": "dias_atraso", "label": "Dias em Atraso", "type": "number", "source": "calculated.days_overdue"}
]',
'[{"field": "payment_status", "operator": "eq", "value": "pending"}]',
'[]',
'none', 'AlertTriangle', 'red'),

-- 4. Produtividade por profissional
(true, 'Produtividade por Profissional', 'Análise de atendimentos, tempo médio e ocupação por profissional', 'atendimento', 'appointments',
'[
  {"name": "profissional", "label": "Profissional", "type": "text", "source": "profiles.full_name"},
  {"name": "atendimentos", "label": "Atendimentos", "type": "number", "aggregation": "count"},
  {"name": "tempo_medio", "label": "Tempo Médio (min)", "type": "duration", "source": "calculated.avg_duration"},
  {"name": "taxa_ocupacao", "label": "Taxa Ocupação", "type": "percentage", "source": "calculated.occupancy_rate"},
  {"name": "faturamento", "label": "Faturamento", "type": "currency", "source": "appointments.price", "aggregation": "sum"}
]',
'[{"field": "start_time", "operator": "between", "label": "Período"}]',
'[{"field": "profissional"}]',
'bar', 'Activity', 'purple'),

-- 5. Cancelamentos e faltas
(true, 'Cancelamentos e Faltas', 'Análise de agendamentos cancelados e pacientes que faltaram', 'atendimento', 'appointments',
'[
  {"name": "data", "label": "Data", "type": "date", "source": "appointments.start_time"},
  {"name": "paciente", "label": "Paciente", "type": "text", "source": "clients.name"},
  {"name": "profissional", "label": "Profissional", "type": "text", "source": "profiles.full_name"},
  {"name": "status", "label": "Status", "type": "text", "source": "appointments.status"},
  {"name": "motivo", "label": "Motivo", "type": "text", "source": "appointments.cancellation_reason"},
  {"name": "valor_perdido", "label": "Valor Perdido", "type": "currency", "source": "appointments.price"}
]',
'[{"field": "status", "operator": "in", "value": ["cancelled", "no_show"]}]',
'[{"field": "data", "interval": "day"}]',
'line', 'XCircle', 'orange'),

-- 6. Tempo de espera
(true, 'Tempo de Espera', 'Análise do tempo entre chegada e início do atendimento', 'atendimento', 'appointments',
'[
  {"name": "data", "label": "Data", "type": "date", "source": "appointments.start_time"},
  {"name": "paciente", "label": "Paciente", "type": "text", "source": "clients.name"},
  {"name": "hora_chegada", "label": "Chegada", "type": "datetime", "source": "appointments.check_in_time"},
  {"name": "hora_inicio", "label": "Início", "type": "datetime", "source": "appointments.actual_start_time"},
  {"name": "tempo_espera", "label": "Tempo Espera (min)", "type": "duration", "source": "calculated.wait_time"}
]',
'[{"field": "start_time", "operator": "between", "label": "Período"}]',
'[{"field": "profissional"}]',
'bar', 'Clock', 'yellow'),

-- 7. Diagnósticos mais frequentes
(true, 'Diagnósticos Mais Frequentes', 'CIDs mais utilizados nos prontuários', 'clinico', 'medical_records',
'[
  {"name": "cid", "label": "CID-10", "type": "text", "source": "medical_records.cid_code"},
  {"name": "descricao", "label": "Descrição", "type": "text", "source": "medical_records.cid_description"},
  {"name": "quantidade", "label": "Quantidade", "type": "number", "aggregation": "count"},
  {"name": "percentual", "label": "% do Total", "type": "percentage", "source": "calculated.percentage"}
]',
'[{"field": "created_at", "operator": "between", "label": "Período"}]',
'[{"field": "cid"}]',
'pie', 'Stethoscope', 'teal'),

-- 8. Procedimentos realizados
(true, 'Procedimentos Realizados', 'TUSS/procedimentos mais executados com valores', 'clinico', 'appointments',
'[
  {"name": "codigo_tuss", "label": "Código TUSS", "type": "text", "source": "services.tuss_code"},
  {"name": "procedimento", "label": "Procedimento", "type": "text", "source": "services.name"},
  {"name": "quantidade", "label": "Quantidade", "type": "number", "aggregation": "count"},
  {"name": "valor_unitario", "label": "Valor Unit.", "type": "currency", "source": "services.price"},
  {"name": "valor_total", "label": "Valor Total", "type": "currency", "source": "appointments.price", "aggregation": "sum"}
]',
'[{"field": "start_time", "operator": "between", "label": "Período"}]',
'[{"field": "procedimento"}]',
'bar', 'FileText', 'indigo'),

-- 9. Origem dos pacientes
(true, 'Origem dos Pacientes', 'Análise de canais de aquisição e taxa de conversão', 'marketing', 'clients',
'[
  {"name": "origem", "label": "Canal de Origem", "type": "text", "source": "clients.source"},
  {"name": "novos_pacientes", "label": "Novos Pacientes", "type": "number", "aggregation": "count"},
  {"name": "agendamentos", "label": "Agendamentos", "type": "number", "source": "calculated.appointments_count"},
  {"name": "conversao", "label": "Taxa Conversão", "type": "percentage", "source": "calculated.conversion_rate"},
  {"name": "faturamento", "label": "Faturamento", "type": "currency", "source": "calculated.revenue", "aggregation": "sum"}
]',
'[{"field": "created_at", "operator": "between", "label": "Período"}]',
'[{"field": "origem"}]',
'pie', 'TrendingUp', 'pink'),

-- 10. Retorno de pacientes
(true, 'Retorno de Pacientes', 'Pacientes que não retornaram há mais de X dias', 'marketing', 'clients',
'[
  {"name": "paciente", "label": "Paciente", "type": "text", "source": "clients.name"},
  {"name": "telefone", "label": "Telefone", "type": "text", "source": "clients.phone"},
  {"name": "email", "label": "E-mail", "type": "text", "source": "clients.email"},
  {"name": "ultima_visita", "label": "Última Visita", "type": "date", "source": "calculated.last_visit"},
  {"name": "dias_sem_retorno", "label": "Dias sem Retorno", "type": "number", "source": "calculated.days_since_visit"},
  {"name": "total_atendimentos", "label": "Total Atendimentos", "type": "number", "source": "calculated.total_appointments"}
]',
'[{"field": "days_since_visit", "operator": "gte", "value": 90, "label": "Dias sem retorno"}]',
'[]',
'none', 'UserX', 'gray');

-- Comentários
COMMENT ON TABLE report_definitions IS 'Definições de relatórios (templates e customizados)';
COMMENT ON TABLE user_saved_reports IS 'Relatórios salvos/favoritos por usuário';
COMMENT ON TABLE report_schedules IS 'Agendamentos de envio automático de relatórios';
COMMENT ON TABLE report_executions IS 'Histórico de execuções de relatórios';
