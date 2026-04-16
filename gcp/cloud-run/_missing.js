const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

const ALLOWED_TABLES = [
  'profiles', 'tenants', 'user_roles', 'patients', 'appointments', 'procedures',
  'medical_records', 'medical_record_versions', 'prescriptions', 'medical_certificates',
  'medical_reports', 'exam_results', 'referrals', 'specialties', 'notifications',
  'commission_rules', 'commission_payments', 'commission_disputes', 'commission_settings',
  'transactions', 'patient_invoices', 'patient_invoice_items', 'patient_payments',
  'insurance_plans', 'tiss_guides', 'tiss_glosa_appeals',
  'automations', 'automation_logs', 'contract_templates', 'contact_messages',
  'waitlist', 'clinic_rooms', 'room_occupancies', 'clinic_units',
  'triage_records', 'nursing_evolutions',
  'treatment_plans', 'treatment_plan_items',
  'dental_anamnesis', 'dental_prescriptions', 'dental_images',
  'aesthetic_sessions', 'aesthetic_protocols', 'aesthetic_areas',
  'consent_templates', 'consent_signatures', 'consent_signing_links',
  'products', 'stock_movements', 'suppliers', 'supplier_orders', 'supplier_order_items',
  'chat_channels', 'chat_messages', 'chat_participants',
  'campaigns', 'campaign_recipients',
  'goal_suggestions', 'goals', 'goal_milestones',
  'nps_responses', 'support_messages', 'support_tickets',
  'video_tutorials', 'user_video_progress',
  'report_executions', 'scheduled_reports',
  'lgpd_data_requests', 'lgpd_consent_logs',
  'hl7_connections', 'hl7_message_log',
  'rnds_certificates',
  'record_field_templates',
  'patient_packages', 'package_consumptions',
  'client_marketing_preferences',
  'audit_logs', 'access_logs',
  'subscription_plans', 'subscriptions',
  'cashback_transactions',
  'salary_payments', 'professional_salaries',
  'cash_sessions', 'cash_movements',
  'professional_working_hours', 'schedule_blocks',
  'inventory_alerts', 'purchase_orders', 'purchase_order_items',
  'financial_transactions',
];

(async () => {
  try {
    // Check which ALLOWED_TABLES exist in DB
    const existing = await p.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
    const existingSet = new Set(existing.rows.map(r => r.table_name));
    
    const missing = ALLOWED_TABLES.filter(t => !existingSet.has(t));
    console.log('MISSING TABLES (in allowlist but not in DB):');
    missing.forEach(t => console.log('  -', t));
    console.log(`\nTotal missing: ${missing.length}`);
  } finally {
    await p.end();
  }
})();
