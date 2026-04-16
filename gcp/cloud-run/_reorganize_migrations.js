/**
 * Reorganiza gcp/migrations/ em estrutura enterprise:
 * 1 arquivo por tabela, organizados em subpastas por domínio.
 * 
 * Extrai DDL direto do Cloud SQL (pg_dump style via information_schema).
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

// Domain mapping: table name → domain folder
const DOMAINS = {
  // 01_foundation
  tenants: '01_foundation',
  profiles: '01_foundation',
  user_roles: '01_foundation',
  role_templates: '01_foundation',
  permission_overrides: '01_foundation',
  subscriptions: '01_foundation',
  tenant_feature_overrides: '01_foundation',
  tenant_limit_overrides: '01_foundation',
  tenant_sequences: '01_foundation',
  tenant_theme_settings: '01_foundation',
  tenant_payment_gateways: '01_foundation',
  specialties: '01_foundation',
  clinic_units: '01_foundation',
  clinic_rooms: '01_foundation',
  rooms: '01_foundation',
  room_occupancies: '01_foundation',
  schedule_blocks: '01_foundation',
  professional_working_hours: '01_foundation',
  email_verification_codes: '01_foundation',
  override_audit_log: '01_foundation',
  rpc_rate_limits: '01_foundation',

  // 02_patients
  patients: '02_patients',
  patient_profiles: '02_patients',
  patient_consents: '02_patients',
  patient_dependents: '02_patients',
  patient_invoices: '02_patients',
  patient_payments: '02_patients',
  patient_messages: '02_patients',
  patient_notifications: '02_patients',
  patient_notification_preferences: '02_patients',
  patient_onboarding: '02_patients',
  patient_packages: '02_patients',
  patient_proms: '02_patients',
  patient_uploaded_exams: '02_patients',
  patient_vaccinations: '02_patients',
  patient_access_attempts: '02_patients',
  patient_achievements: '02_patients',
  patient_activity_log: '02_patients',
  patient_calls: '02_patients',
  patient_deletion_requests: '02_patients',
  client_packages: '02_patients',
  client_package_ledger: '02_patients',
  client_marketing_preferences: '02_patients',
  insurance_plans: '02_patients',
  pre_consultation_forms: '02_patients',
  pre_consultation_responses: '02_patients',
  return_reminders: '02_patients',
  return_confirmation_tokens: '02_patients',

  // 03_appointments
  appointments: '03_appointments',
  appointment_ratings: '03_appointments',
  appointment_completion_summaries: '03_appointments',
  appointment_cashback_earnings: '03_appointments',
  appointment_package_consumptions: '03_appointments',
  waitlist: '03_appointments',
  waitlist_notifications: '03_appointments',

  // 04_clinical
  medical_records: '04_clinical',
  medical_record_versions: '04_clinical',
  medical_certificates: '04_clinical',
  medical_reports: '04_clinical',
  clinical_evolutions: '04_clinical',
  nursing_evolutions: '04_clinical',
  prescriptions: '04_clinical',
  prescription_refill_requests: '04_clinical',
  dental_prescriptions: '04_clinical',
  referrals: '04_clinical',
  exam_results: '04_clinical',
  triage_records: '04_clinical',
  procedures: '04_clinical',
  treatment_plans: '04_clinical',
  treatment_plan_items: '04_clinical',
  prontuario_exports: '04_clinical',
  record_field_templates: '04_clinical',
  archived_clinical_data: '04_clinical',
  transcription_jobs: '04_clinical',

  // 05_odontology
  odontograms: '05_odontology',
  odontogram_teeth: '05_odontology',
  odontogram_tooth_surfaces: '05_odontology',
  odontogram_tooth_history: '05_odontology',
  odontogram_annotations: '05_odontology',
  dental_images: '05_odontology',
  periograms: '05_odontology',
  periogram_measurements: '05_odontology',
  tuss_odonto_prices: '05_odontology',

  // 06_aesthetic
  aesthetic_anamnesis: '06_aesthetic',
  aesthetic_protocols: '06_aesthetic',

  // 07_financial
  financial_transactions: '07_financial',
  payments: '07_financial',
  payment_methods: '07_financial',
  bills_payable: '07_financial',
  bills_receivable: '07_financial',
  accounts_receivable: '07_financial',
  cash_sessions: '07_financial',
  cash_movements: '07_financial',
  cost_centers: '07_financial',
  commission_rules: '07_financial',
  commission_payments: '07_financial',
  commission_disputes: '07_financial',
  professional_commissions: '07_financial',
  professional_payment_accounts: '07_financial',
  professional_tier_tracking: '07_financial',
  salary_payments: '07_financial',
  split_payment_logs: '07_financial',
  nfse_invoices: '07_financial',
  discount_coupons: '07_financial',
  orders: '07_financial',
  order_items: '07_financial',
  asaas_checkout_sessions: '07_financial',
  asaas_webhook_events: '07_financial',
  asaas_webhook_alerts: '07_financial',
  stripe_webhook_events: '07_financial',

  // 08_products_inventory
  products: '08_products_inventory',
  product_categories: '08_products_inventory',
  product_usage: '08_products_inventory',
  stock_movements: '08_products_inventory',
  suppliers: '08_products_inventory',
  purchases: '08_products_inventory',
  purchase_items: '08_products_inventory',

  // 09_loyalty_gamification
  cashback_wallets: '09_loyalty_gamification',
  cashback_ledger: '09_loyalty_gamification',
  points_wallets: '09_loyalty_gamification',
  points_ledger: '09_loyalty_gamification',
  health_credits_balance: '09_loyalty_gamification',
  health_credits_transactions: '09_loyalty_gamification',
  health_credits_rules: '09_loyalty_gamification',
  health_credits_redemption_config: '09_loyalty_gamification',
  loyalty_tiers: '09_loyalty_gamification',
  vouchers: '09_loyalty_gamification',
  voucher_redemptions: '09_loyalty_gamification',
  goal_templates: '09_loyalty_gamification',
  goals: '09_loyalty_gamification',
  goal_achievements: '09_loyalty_gamification',
  goal_suggestions: '09_loyalty_gamification',

  // 10_communication
  notifications: '10_communication',
  notification_logs: '10_communication',
  push_subscriptions: '10_communication',
  push_notifications_log: '10_communication',
  internal_messages: '10_communication',
  message_templates: '10_communication',
  chat_channels: '10_communication',
  chat_channel_members: '10_communication',
  chat_read_status: '10_communication',
  chatbot_conversations: '10_communication',
  chatbot_messages: '10_communication',
  chatbot_settings: '10_communication',
  campaigns: '10_communication',
  campaign_deliveries: '10_communication',
  sales_leads: '10_communication',
  sales_chatbot_conversations: '10_communication',
  sales_chatbot_messages: '10_communication',
  nps_responses: '10_communication',
  feedback_analysis: '10_communication',

  // 11_consent_documents
  consent_templates: '11_consent_documents',
  consent_forms: '11_consent_documents',
  consent_signing_tokens: '11_consent_documents',
  document_signatures: '11_consent_documents',
  document_verifications: '11_consent_documents',
  profile_certificates: '11_consent_documents',

  // 12_ai
  ai_conversations: '12_ai',
  ai_conversation_messages: '12_ai',
  ai_performance_metrics: '12_ai',
  ai_usage_log: '12_ai',

  // 13_integrations
  hl7_connections: '13_integrations',
  hl7_field_mappings: '13_integrations',
  hl7_message_log: '13_integrations',
  hl7_patient_mapping: '13_integrations',
  rnds_certificates: '13_integrations',
  rnds_submissions: '13_integrations',
  rnds_tokens: '13_integrations',
  incoming_rnds_bundles: '13_integrations',
  tsa_config: '13_integrations',
  tsa_timestamps: '13_integrations',

  // 14_sngpc
  sngpc_agendamentos: '14_sngpc',
  sngpc_credenciais: '14_sngpc',
  sngpc_estoque: '14_sngpc',
  sngpc_movimentacoes: '14_sngpc',
  sngpc_notificacoes_receita: '14_sngpc',
  sngpc_sequencial: '14_sngpc',
  sngpc_tracked_prescriptions: '14_sngpc',
  sngpc_transmissoes: '14_sngpc',
  sngpc_transmissoes_log: '14_sngpc',

  // 15_lgpd_compliance
  lgpd_consentimentos: '15_lgpd_compliance',
  lgpd_data_requests: '15_lgpd_compliance',
  lgpd_incidentes: '15_lgpd_compliance',
  lgpd_retention_policies: '15_lgpd_compliance',
  lgpd_solicitacoes: '15_lgpd_compliance',
  dpo_config: '15_lgpd_compliance',
  ripd_reports: '15_lgpd_compliance',
  retention_deletion_attempts: '15_lgpd_compliance',

  // 16_audit_security
  audit_logs: '16_audit_security',
  admin_audit_logs: '16_audit_security',
  adverse_events: '16_audit_security',
  adverse_events_attachments: '16_audit_security',
  adverse_events_history: '16_audit_security',
  ona_indicators: '16_audit_security',
  sbis_documentation: '16_audit_security',
  backup_logs: '16_audit_security',
  backup_retention_policies: '16_audit_security',
  backup_verifications: '16_audit_security',

  // 17_automation
  automations: '17_automation',
  automation_dispatch_logs: '17_automation',

  // 18_reports
  report_definitions: '18_reports',
  report_executions: '18_reports',
  report_schedules: '18_reports',
  user_saved_reports: '18_reports',

  // 19_support
  support_tickets: '19_support',
  support_messages: '19_support',
  contact_messages: '19_support',

  // 20_user_preferences
  user_keyboard_shortcuts: '20_user_preferences',
  user_notification_preferences: '20_user_preferences',
  user_tour_progress: '20_user_preferences',
  user_video_progress: '20_user_preferences',
  video_tutorials: '20_user_preferences',
  offline_cache_metadata: '20_user_preferences',
};

async function getTableDDL(tableName) {
  // Get columns
  const cols = await p.query(`
    SELECT column_name, data_type, udt_name, character_maximum_length,
           column_default, is_nullable, is_identity,
           identity_generation
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = $1 
    ORDER BY ordinal_position
  `, [tableName]);

  // Get primary key
  const pk = await p.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `, [tableName]);

  // Get unique constraints 
  const uq = await p.query(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'UNIQUE'
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `, [tableName]);

  // Get foreign keys
  const fk = await p.query(`
    SELECT tc.constraint_name, kcu.column_name, 
           ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
  `, [tableName]);

  // Get indexes
  const idx = await p.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = $1
    ORDER BY indexname
  `, [tableName]);

  // Build DDL
  let ddl = `-- Table: ${tableName}\n`;
  ddl += `-- Domain: ${DOMAINS[tableName] || 'uncategorized'}\n`;
  ddl += `-- Generated from Cloud SQL on ${new Date().toISOString().slice(0, 10)}\n\n`;
  ddl += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

  const colLines = [];
  for (const col of cols.rows) {
    let type = col.udt_name;
    // Map common types
    if (type === 'int4') type = 'INTEGER';
    else if (type === 'int8') type = 'BIGINT';
    else if (type === 'int2') type = 'SMALLINT';
    else if (type === 'float8') type = 'DOUBLE PRECISION';
    else if (type === 'float4') type = 'REAL';
    else if (type === 'bool') type = 'BOOLEAN';
    else if (type === 'varchar') type = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR';
    else if (type === 'timestamptz') type = 'TIMESTAMPTZ';
    else if (type === 'timestamp') type = 'TIMESTAMP';
    else if (type === 'uuid') type = 'UUID';
    else if (type === 'text') type = 'TEXT';
    else if (type === 'jsonb') type = 'JSONB';
    else if (type === 'json') type = 'JSON';
    else if (type === 'numeric') type = 'NUMERIC';
    else if (type === 'date') type = 'DATE';
    else if (type === 'time') type = 'TIME';
    else if (type === 'bytea') type = 'BYTEA';
    else if (type === '_text') type = 'TEXT[]';
    else if (type === '_uuid') type = 'UUID[]';
    else if (type === '_int4') type = 'INTEGER[]';
    else if (type === '_varchar') type = 'VARCHAR[]';
    else if (type === '_jsonb') type = 'JSONB[]';
    else type = type.toUpperCase();

    let line = `  ${col.column_name} ${type}`;
    if (col.column_default) {
      let def = col.column_default;
      // Clean up defaults
      def = def.replace(/::[\w\s\[\]]+$/, '');
      line += ` DEFAULT ${def}`;
    }
    if (col.is_nullable === 'NO') line += ' NOT NULL';
    colLines.push(line);
  }

  // Primary key
  if (pk.rows.length > 0) {
    colLines.push(`  PRIMARY KEY (${pk.rows.map(r => r.column_name).join(', ')})`);
  }

  ddl += colLines.join(',\n');
  ddl += '\n);\n';

  // Unique constraints
  const uniqueGroups = {};
  for (const row of uq.rows) {
    if (!uniqueGroups[row.constraint_name]) uniqueGroups[row.constraint_name] = [];
    uniqueGroups[row.constraint_name].push(row.column_name);
  }
  for (const [name, columns] of Object.entries(uniqueGroups)) {
    ddl += `\nALTER TABLE public.${tableName} ADD CONSTRAINT ${name} UNIQUE (${columns.join(', ')});\n`;
  }

  // Foreign keys
  for (const row of fk.rows) {
    ddl += `\nALTER TABLE public.${tableName} ADD CONSTRAINT ${row.constraint_name}\n`;
    ddl += `  FOREIGN KEY (${row.column_name}) REFERENCES public.${row.ref_table}(${row.ref_column});\n`;
  }

  // Indexes (skip pkey and unique — already covered)
  for (const row of idx.rows) {
    if (row.indexname.endsWith('_pkey')) continue;
    if (Object.keys(uniqueGroups).includes(row.indexname)) continue;
    ddl += `\n${row.indexdef};\n`;
  }

  return ddl;
}

(async () => {
  const dbResult = await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const tables = dbResult.rows.map(r => r.tablename);

  const outputDir = path.join(__dirname, '..', 'migrations');

  // Clean old structure
  console.log('Limpando estrutura antiga...');
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  // Track stats
  const stats = {};
  let uncategorized = [];

  for (const table of tables) {
    const domain = DOMAINS[table] || null;
    if (!domain) {
      uncategorized.push(table);
      continue;
    }

    const domainDir = path.join(outputDir, domain);
    if (!fs.existsSync(domainDir)) fs.mkdirSync(domainDir, { recursive: true });

    const ddl = await getTableDDL(table);
    const filePath = path.join(domainDir, `${table}.sql`);
    fs.writeFileSync(filePath, ddl);

    if (!stats[domain]) stats[domain] = 0;
    stats[domain]++;
    process.stdout.write(`\r  ${Object.values(stats).reduce((a, b) => a + b, 0)}/${tables.length} tabelas...`);
  }

  // Handle uncategorized
  if (uncategorized.length > 0) {
    const dir = path.join(outputDir, '99_uncategorized');
    fs.mkdirSync(dir, { recursive: true });
    for (const table of uncategorized) {
      const ddl = await getTableDDL(table);
      fs.writeFileSync(path.join(dir, `${table}.sql`), ddl);
    }
    stats['99_uncategorized'] = uncategorized.length;
  }

  console.log('\n\n=== ESTRUTURA ENTERPRISE GERADA ===\n');
  console.log(`gcp/migrations/`);
  for (const [domain, count] of Object.entries(stats).sort()) {
    console.log(`  ${domain}/ → ${count} tabelas`);
  }
  console.log(`\nTotal: ${tables.length} tabelas em ${Object.keys(stats).length} domínios`);

  if (uncategorized.length) {
    console.log(`\n⚠ Não categorizadas (${uncategorized.length}):`);
    uncategorized.forEach(t => console.log(`  - ${t}`));
  }

  await p.end();
})();
