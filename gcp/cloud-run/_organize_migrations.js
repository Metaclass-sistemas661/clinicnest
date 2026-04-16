const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync(path.join(__dirname, '_full_schema.sql'), 'utf-8');

// Split by "-- Table:" markers
const blocks = schema.split(/(?=^-- Table: )/m).filter(b => b.startsWith('-- Table:'));

console.log(`Total table blocks: ${blocks.length}`);

// Categorize tables into migration groups
const categories = {
  '001_foundation': {
    file: '001_core_tables.sql',
    desc: 'Core tables: tenants, profiles, subscriptions, auth, permissions',
    tables: [
      'tenants', 'profiles', 'subscriptions', 'user_roles', 'permission_overrides',
      'role_templates', 'email_verification_codes', 'tenant_sequences',
      'tenant_theme_settings', 'tenant_feature_overrides', 'tenant_limit_overrides',
      'override_audit_log', 'specialties', 'clinic_units', 'rooms', 'clinic_rooms',
      'payment_methods', 'tenant_payment_gateways', 'rpc_rate_limits'
    ]
  },
  '002_patients': {
    file: '001_patients.sql',
    desc: 'Patient-related tables',
    tables: [
      'patients', 'clients', 'patient_profiles', 'patient_dependents',
      'patient_onboarding', 'patient_access_attempts', 'patient_achievements',
      'patient_activity_log', 'patient_notification_preferences', 'patient_notifications',
      'patient_uploaded_exams', 'patient_vaccinations', 'patient_payments',
      'patient_packages', 'patient_invoices', 'patient_messages',
      'patient_consents', 'patient_proms', 'patient_calls', 'patient_deletion_requests',
      'client_marketing_preferences', 'client_packages', 'client_package_ledger',
      'insurance_plans'
    ]
  },
  '003_clinical': {
    file: '001_clinical.sql',
    desc: 'Clinical/medical tables: appointments, records, prescriptions, evolutions',
    tables: [
      'appointments', 'medical_records', 'medical_record_versions', 'medical_certificates',
      'medical_reports', 'prescriptions', 'prescription_refill_requests',
      'clinical_evolutions', 'nursing_evolutions', 'exam_results',
      'triage_records', 'pre_consultation_forms', 'pre_consultation_responses',
      'record_field_templates', 'appointment_ratings', 'appointment_completion_summaries',
      'archived_clinical_data', 'referrals', 'adverse_events',
      'adverse_events_attachments', 'adverse_events_history',
      'prontuario_exports', 'schedule_blocks', 'professional_working_hours',
      'return_reminders', 'return_confirmation_tokens', 'room_occupancies',
      'waitlist', 'waitlist_notifications'
    ]
  },
  '004_odontology': {
    file: '001_odontology.sql',
    desc: 'Dental/odontology tables',
    tables: [
      'odontograms', 'odontogram_teeth', 'odontogram_tooth_surfaces',
      'odontogram_tooth_history', 'odontogram_annotations', 'dental_images',
      'dental_prescriptions', 'treatment_plans', 'treatment_plan_items',
      'tuss_odonto_prices', 'periograms', 'periogram_measurements'
    ]
  },
  '005_aesthetic': {
    file: '001_aesthetic.sql',
    desc: 'Aesthetic module tables',
    tables: [
      'aesthetic_anamnesis', 'aesthetic_protocols'
    ]
  },
  '006_financial': {
    file: '001_financial.sql',
    desc: 'Financial tables: transactions, billing, commissions, payments',
    tables: [
      'financial_transactions', 'bills_payable', 'bills_receivable',
      'accounts_receivable', 'cash_sessions', 'cash_movements',
      'cost_centers', 'nfse_invoices', 'payments', 'orders', 'order_items',
      'commission_rules', 'commission_payments', 'commission_disputes',
      'professional_commissions', 'professional_payment_accounts',
      'professional_tier_tracking', 'salary_payments', 'split_payment_logs',
      'discount_coupons', 'vouchers', 'voucher_redemptions',
      'appointment_cashback_earnings', 'cashback_ledger', 'cashback_wallets',
      'health_credits_balance', 'health_credits_redemption_config',
      'health_credits_rules', 'health_credits_transactions',
      'loyalty_tiers', 'points_ledger', 'points_wallets',
      'appointment_package_consumptions'
    ]
  },
  '007_products': {
    file: '001_products.sql',
    desc: 'Products, stock, suppliers, purchases',
    tables: [
      'products', 'product_categories', 'product_usage',
      'stock_movements', 'suppliers', 'purchases', 'purchase_items',
      'procedures', 'services'
    ]
  },
  '008_communication': {
    file: '001_communication.sql',
    desc: 'Chat, messaging, campaigns, notifications, chatbot',
    tables: [
      'chat_channels', 'chat_channel_members', 'chat_read_status',
      'internal_messages', 'notifications', 'notification_logs',
      'push_subscriptions', 'push_notifications_log',
      'message_templates', 'campaigns', 'campaign_deliveries',
      'contact_messages', 'nps_responses', 'feedback_analysis',
      'chatbot_conversations', 'chatbot_messages', 'chatbot_settings',
      'sales_chatbot_conversations', 'sales_chatbot_messages', 'sales_leads'
    ]
  },
  '009_consent_documents': {
    file: '001_consent_documents.sql',
    desc: 'Consent forms, templates, signatures, documents',
    tables: [
      'consent_templates', 'consent_forms', 'consent_signing_tokens',
      'document_signatures', 'document_verifications'
    ]
  },
  '010_ai': {
    file: '001_ai.sql',
    desc: 'AI conversations and usage tracking',
    tables: [
      'ai_conversations', 'ai_conversation_messages',
      'ai_performance_metrics', 'ai_usage_log', 'transcription_jobs'
    ]
  },
  '011_integrations': {
    file: '001_integrations.sql',
    desc: 'External integrations: Stripe, Asaas, RNDS, HL7, TISS, SNGPC',
    tables: [
      'stripe_webhook_events', 'asaas_checkout_sessions', 'asaas_webhook_alerts',
      'asaas_webhook_events', 'rnds_tokens', 'rnds_certificates',
      'rnds_submissions', 'rnds_incoming_statistics', 'incoming_rnds_bundles',
      'hl7_connections', 'hl7_field_mappings', 'hl7_message_log', 'hl7_patient_mapping',
      'tiss_guides', 'tiss_glosa_appeals',
      'sngpc_agendamentos', 'sngpc_credenciais', 'sngpc_estoque',
      'sngpc_movimentacoes', 'sngpc_notificacoes_receita', 'sngpc_sequencial',
      'sngpc_tracked_prescriptions', 'sngpc_transmissoes', 'sngpc_transmissoes_log'
    ]
  },
  '012_lgpd_compliance': {
    file: '001_lgpd_compliance.sql',
    desc: 'LGPD, audit, compliance, backup, RIPD, DPO, TSA, SBIS',
    tables: [
      'lgpd_consentimentos', 'lgpd_data_requests', 'lgpd_incidentes',
      'lgpd_retention_policies', 'lgpd_solicitacoes',
      'audit_logs', 'admin_audit_logs',
      'audit_policies_permissive', 'audit_public_tables_missing_tenant_id',
      'audit_rls_tables_without_policies', 'audit_tables_without_rls',
      'backup_logs', 'backup_retention_policies', 'backup_verifications',
      'retention_deletion_attempts', 'ripd_reports', 'dpo_config',
      'tsa_config', 'tsa_timestamps', 'sbis_documentation',
      'ona_indicators'
    ]
  },
  '013_automation_goals': {
    file: '001_automation_goals.sql',
    desc: 'Automations, goals, gamification, tours, tutorials',
    tables: [
      'automations', 'automation_dispatch_logs',
      'goals', 'goal_achievements', 'goal_suggestions', 'goal_templates',
      'video_tutorials', 'user_video_progress', 'user_tour_progress',
      'user_notification_preferences', 'user_keyboard_shortcuts',
      'user_saved_reports', 'offline_cache_metadata',
      'support_tickets', 'support_messages'
    ]
  },
  '014_reports': {
    file: '001_reports.sql',
    desc: 'Report definitions, executions, schedules',
    tables: [
      'report_definitions', 'report_executions', 'report_schedules'
    ]
  },
  '015_profile_extras': {
    file: '001_profile_extras.sql',
    desc: 'Profile certificates and related',
    tables: [
      'profile_certificates'
    ]
  }
};

// Build a lookup: table_name -> block
const tableBlocks = {};
for (const block of blocks) {
  const match = block.match(/^-- Table: (\S+)/);
  if (match) tableBlocks[match[1]] = block;
}

// Track assigned tables
const assigned = new Set();
const migrationsDir = path.join(__dirname, '..', 'migrations');

for (const [dir, config] of Object.entries(categories)) {
  const dirPath = path.join(migrationsDir, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

  const filePath = path.join(dirPath, config.file);
  let content = `-- ============================================\n`;
  content += `-- ${config.desc}\n`;
  content += `-- Generated from Cloud SQL schema dump\n`;
  content += `-- Date: ${new Date().toISOString().split('T')[0]}\n`;
  content += `-- ============================================\n\n`;

  let count = 0;
  for (const table of config.tables) {
    if (tableBlocks[table]) {
      content += tableBlocks[table] + '\n';
      assigned.add(table);
      count++;
    }
  }

  // Don't overwrite existing files (003_tenants.sql, 006_subscriptions.sql)
  if (fs.existsSync(filePath)) {
    console.log(`  SKIP ${dir}/${config.file} (already exists) — ${count} tables`);
  } else {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ ${dir}/${config.file} — ${count} tables`);
  }
}

// Report unassigned tables
const unassigned = Object.keys(tableBlocks).filter(t => !assigned.has(t));
if (unassigned.length > 0) {
  console.log(`\nUnassigned tables (${unassigned.length}):`);
  unassigned.forEach(t => console.log(`  - ${t}`));
}

console.log(`\nDone! ${assigned.size} tables assigned across ${Object.keys(categories).length} migration files.`);
