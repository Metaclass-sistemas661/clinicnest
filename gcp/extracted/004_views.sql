-- GCP Migration: All Views
-- Total: 17 views


-- ============================================
-- View: v_odontogram_summary
-- Source: 20260325000001_odontograms_v1.sql
-- ============================================
CREATE OR REPLACE VIEW public.v_odontogram_summary AS
SELECT 
  o.id as odontogram_id,
  o.tenant_id,
  o.client_id,
  c.name as client_name,
  o.professional_id,
  p.full_name as professional_name,
  o.exam_date,
  o.notes,
  COUNT(t.id) as total_teeth,
  COUNT(t.id) FILTER (WHERE t.condition = 'healthy') as healthy_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'caries') as caries_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'restored') as restored_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'missing') as missing_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'crown') as crown_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'implant') as implant_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'endodontic') as endodontic_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'extraction') as extraction_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'prosthesis') as prosthesis_count,
  COUNT(t.id) FILTER (WHERE t.condition = 'fracture') as fracture_count,
  o.created_at
FROM public.odontograms o
LEFT JOIN public.odontogram_teeth t ON t.odontogram_id = o.id
LEFT JOIN public.clients c ON c.id = o.client_id
LEFT JOIN public.profiles p ON p.id = o.professional_id
GROUP BY o.id, o.tenant_id, o.client_id, c.name, o.professional_id, p.full_name, o.exam_date, o.notes, o.created_at;


-- ============================================
-- View: audit_tables_without_rls
-- Source: 20260308000000_rls_audit_checklist.sql
-- ============================================
create or replace view public.audit_tables_without_rls as
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
  and n.nspname not like 'pg_%'
  and c.relname not like 'supabase_%'
  and c.relrowsecurity is false
order by 1, 2;


-- ============================================
-- View: audit_rls_tables_without_policies
-- Source: 20260308000000_rls_audit_checklist.sql
-- ============================================
create or replace view public.audit_rls_tables_without_policies as
with rls_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
    and n.nspname not like 'pg_%'
    and c.relname not like 'supabase_%'
    and c.relrowsecurity is true
)
select
  t.schema_name,
  t.table_name
from rls_tables t
left join pg_policy p on p.polrelid = t.oid
where p.oid is null
order by 1, 2;


-- ============================================
-- View: audit_policies_permissive
-- Source: 20260308000000_rls_audit_checklist.sql
-- ============================================
create or replace view public.audit_policies_permissive as
select
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname as policy_name,
  case p.polcmd
    when 'r' then 'SELECT'
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'd' then 'DELETE'
    when '*' then 'ALL'
    else p.polcmd::text
  end as command,
  pg_get_expr(p.polqual, p.polrelid) as using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
  and n.nspname not like 'pg_%'
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') in ('true', '(true)')
    or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') in ('true', '(true)')
  )
order by 1, 2, 3;


-- ============================================
-- View: audit_public_tables_missing_tenant_id
-- Source: 20260308000000_rls_audit_checklist.sql
-- ============================================
create or replace view public.audit_public_tables_missing_tenant_id as
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname not in (
    'tenants',
    'subscriptions',
    'contact_messages',
    'lgpd_requests',
    'lgpd_consent',
    'admin_audit_logs'
  )
  and not exists (
    select 1
    from information_schema.columns col
    where col.table_schema = n.nspname
      and col.table_name = c.relname
      and col.column_name = 'tenant_id'
  )
order by 1, 2;


-- ============================================
-- View: sngpc_livro_registro
-- Source: 20260323900000_sngpc_livro_registro_v1.sql
-- ============================================
CREATE OR REPLACE VIEW sngpc_livro_registro AS
SELECT 
  m.id,
  m.tenant_id,
  m.data_movimentacao,
  m.tipo_movimentacao,
  e.medicamento_codigo,
  e.medicamento_nome,
  e.lista,
  e.lote,
  m.quantidade,
  m.saldo_anterior,
  m.saldo_posterior,
  m.paciente_nome,
  m.paciente_cpf,
  m.prescriptor_nome,
  m.prescriptor_crm,
  m.numero_receita,
  m.comprador_nome,
  m.comprador_rg,
  m.fornecedor_nome,
  m.nota_fiscal,
  m.motivo_perda,
  m.usuario_nome,
  m.observacoes
FROM sngpc_movimentacoes m
JOIN sngpc_estoque e ON e.id = m.estoque_id
ORDER BY m.data_movimentacao DESC;


-- ============================================
-- View: sngpc_balanco_estoque
-- Source: 20260323900000_sngpc_livro_registro_v1.sql
-- ============================================
CREATE OR REPLACE VIEW sngpc_balanco_estoque AS
SELECT 
  tenant_id,
  medicamento_codigo,
  medicamento_nome,
  lista,
  SUM(quantidade_atual) as quantidade_total,
  COUNT(DISTINCT lote) as qtd_lotes,
  MIN(data_validade) as proxima_validade,
  SUM(quantidade_atual * COALESCE(preco_unitario, 0)) as valor_total
FROM sngpc_estoque
WHERE quantidade_atual > 0
GROUP BY tenant_id, medicamento_codigo, medicamento_nome, lista;


-- ============================================
-- View: sngpc_transmissoes_dashboard
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
-- ============================================
CREATE OR REPLACE VIEW sngpc_transmissoes_dashboard AS
SELECT 
  t.tenant_id,
  COUNT(*) FILTER (WHERE t.status = 'validado') as total_validados,
  COUNT(*) FILTER (WHERE t.status = 'erro') as total_erros,
  COUNT(*) FILTER (WHERE t.status = 'pendente') as total_pendentes,
  COUNT(*) FILTER (WHERE t.status = 'enviado') as total_aguardando,
  COUNT(*) as total_transmissoes,
  MAX(t.data_envio) FILTER (WHERE t.status = 'validado') as ultima_transmissao_sucesso,
  MAX(t.data_envio) as ultima_tentativa,
  SUM(t.total_medicamentos) as total_medicamentos_transmitidos,
  ROUND(
    COUNT(*) FILTER (WHERE t.status = 'validado')::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as taxa_sucesso
FROM sngpc_transmissoes t
GROUP BY t.tenant_id;


-- ============================================
-- View: vw_lgpd_solicitacoes_pendentes
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
-- ============================================
CREATE OR REPLACE VIEW vw_lgpd_solicitacoes_pendentes AS
SELECT 
  s.*,
  CASE 
    WHEN s.prazo_resposta < NOW() THEN 'ATRASADA'
    WHEN s.prazo_resposta < NOW() + INTERVAL '3 days' THEN 'URGENTE'
    ELSE 'NO_PRAZO'
  END AS situacao_prazo,
  EXTRACT(DAY FROM s.prazo_resposta - NOW()) AS dias_restantes
FROM lgpd_solicitacoes s
WHERE s.status NOT IN ('concluida', 'negada', 'cancelada');


-- ============================================
-- View: vw_lgpd_incidentes_notificacao
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
-- ============================================
CREATE OR REPLACE VIEW vw_lgpd_incidentes_notificacao AS
SELECT 
  i.*,
  CASE 
    WHEN i.prazo_notificacao < NOW() AND NOT i.notificacao_anpd_enviada THEN 'ATRASADA'
    WHEN i.prazo_notificacao < NOW() + INTERVAL '24 hours' AND NOT i.notificacao_anpd_enviada THEN 'URGENTE'
    ELSE 'NO_PRAZO'
  END AS situacao_notificacao,
  EXTRACT(HOUR FROM i.prazo_notificacao - NOW()) AS horas_restantes
FROM lgpd_incidentes i
WHERE i.requer_notificacao_anpd = true
  AND i.notificacao_anpd_enviada = false;


-- ============================================
-- View: v_referral_report
-- Source: 20260328300000_fix_referral_report_types_v2.sql
-- ============================================
CREATE OR REPLACE VIEW public.v_referral_report AS
SELECT 
    a.tenant_id,
    a.booked_by_id AS referrer_id,
    COALESCE(p.full_name, 'Desconhecido') AS referrer_name,
    COALESCE(p.professional_type::text, 'staff') AS referrer_role,
    DATE_TRUNC('month', a.scheduled_at)::timestamptz AS month,
    COUNT(DISTINCT a.id)::bigint AS total_appointments,
    COUNT(DISTINCT a.client_id)::bigint AS unique_patients,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END)::bigint AS completed_appointments,
    COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0)::decimal AS total_revenue,
    COALESCE(SUM(cp.amount), 0)::decimal AS total_commission
FROM public.appointments a
LEFT JOIN public.profiles p ON p.user_id = a.booked_by_id AND p.tenant_id = a.tenant_id
LEFT JOIN public.services s ON s.id = a.service_id
LEFT JOIN public.commission_payments cp ON cp.appointment_id = a.id 
    AND cp.professional_id = a.booked_by_id
WHERE a.booked_by_id IS NOT NULL
GROUP BY 
    a.tenant_id,
    a.booked_by_id,
    p.full_name,
    p.professional_type,
    DATE_TRUNC('month', a.scheduled_at);


-- ============================================
-- View: clients
-- Source: 20260330300000_rename_clients_to_patients_v1.sql
-- ============================================
CREATE OR REPLACE VIEW public.clients AS 
SELECT * FROM public.patients;


-- ============================================
-- View: services
-- Source: 20260330400000_rename_services_to_procedures_v1.sql
-- ============================================
CREATE OR REPLACE VIEW public.services AS 
SELECT * FROM public.procedures;


-- ============================================
-- View: cfm_compliance_summary
-- Source: 20260330800000_cfm_required_fields_v1.sql
-- ============================================
CREATE OR REPLACE VIEW public.cfm_compliance_summary AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id) as total_records,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.signed_at IS NOT NULL) as signed_records,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.signed_by_uf IS NOT NULL) as records_with_uf,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.attendance_number IS NOT NULL) as records_with_attendance_number,
  (SELECT COUNT(*) FROM public.medical_records mr WHERE mr.tenant_id = t.id AND mr.server_timestamp IS NOT NULL) as records_with_server_timestamp,
  (SELECT COUNT(*) FROM public.medical_certificates mc WHERE mc.tenant_id = t.id) as total_certificates,
  (SELECT COUNT(*) FROM public.medical_certificates mc WHERE mc.tenant_id = t.id AND mc.signed_at IS NOT NULL) as signed_certificates
FROM public.tenants t;


-- ============================================
-- View: verifiable_documents
-- Source: 20260331000000_prescriptions_signature_fields_v1.sql
-- ============================================
CREATE OR REPLACE VIEW public.verifiable_documents AS
SELECT 
  'medical_certificate'::verifiable_document_type AS document_type,
  mc.id AS document_id,
  mc.digital_signature AS hash,
  mc.signed_at,
  mc.signed_by_name AS signer_name,
  mc.signed_by_crm AS signer_crm,
  mc.signed_by_uf AS signer_uf,
  mc.certificate_type AS doc_subtype,
  mc.created_at,
  mc.tenant_id,
  CASE WHEN mc.digital_signature IS NOT NULL AND mc.signed_at IS NOT NULL THEN true ELSE false END AS is_signed
FROM public.medical_certificates mc
WHERE mc.digital_signature IS NOT NULL

UNION ALL

SELECT 
  'prescription'::verifiable_document_type AS document_type,
  pr.id AS document_id,
  COALESCE(pr.digital_hash, pr.digital_signature) AS hash,
  pr.signed_at,
  pr.signed_by_name AS signer_name,
  pr.signed_by_crm AS signer_crm,
  pr.signed_by_uf AS signer_uf,
  pr.prescription_type AS doc_subtype,
  pr.created_at,
  pr.tenant_id,
  CASE WHEN (pr.digital_hash IS NOT NULL OR pr.digital_signature IS NOT NULL) AND pr.signed_at IS NOT NULL THEN true ELSE false END AS is_signed
FROM public.prescriptions pr
WHERE pr.digital_hash IS NOT NULL OR pr.digital_signature IS NOT NULL;


-- ============================================
-- View: mv_dental_stats
-- Source: 20260719000000_dental_module_enhancements_v1.sql
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_dental_stats AS
SELECT 
  o.tenant_id,
  o.client_id AS patient_id,
  COUNT(DISTINCT o.id) AS total_odontograms,
  COUNT(DISTINCT ot.id) AS total_tooth_records,
  COUNT(DISTINCT CASE WHEN ot.condition = 'caries' THEN ot.id END) AS total_caries,
  COUNT(DISTINCT CASE WHEN ot.condition = 'missing' THEN ot.id END) AS total_missing,
  COUNT(DISTINCT CASE WHEN ot.condition = 'restored' THEN ot.id END) AS total_restored,
  COUNT(DISTINCT CASE WHEN ot.priority = 'urgent' THEN ot.id END) AS total_urgent,
  MAX(o.exam_date) AS last_exam_date,
  (SELECT COUNT(*) FROM public.treatment_plans tp 
   WHERE tp.client_id = o.client_id AND tp.tenant_id = o.tenant_id AND tp.status = 'em_andamento') AS active_plans,
  (SELECT COUNT(*) FROM public.periograms p 
   WHERE p.client_id = o.client_id AND p.tenant_id = o.tenant_id) AS total_periograms
FROM public.odontograms o
LEFT JOIN public.odontogram_teeth ot ON ot.odontogram_id = o.id
GROUP BY o.tenant_id, o.client_id;


-- ============================================
-- View: rnds_incoming_statistics
-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
-- ============================================
CREATE OR REPLACE VIEW public.rnds_incoming_statistics AS
SELECT
  tenant_id,
  COUNT(*) AS total_received,
  COUNT(*) FILTER (WHERE review_status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE review_status = 'accepted') AS accepted_count,
  COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected_count,
  COUNT(*) FILTER (WHERE review_status = 'merged') AS merged_count,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) AS error_count,
  MAX(received_at) AS last_received_at
FROM public.incoming_rnds_bundles
GROUP BY tenant_id;

