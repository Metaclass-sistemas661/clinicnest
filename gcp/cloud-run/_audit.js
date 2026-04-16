const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  try {
    // Get all tables
    const tables = await p.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name
    `);
    console.log('=== EXISTING TABLES ===');
    console.log(tables.rows.map(r => r.table_name).join('\n'));
    console.log(`Total: ${tables.rows.length} tables\n`);

    // For key tables, get all columns
    const keyTables = [
      'patients', 'appointments', 'profiles', 'procedures', 'products',
      'stock_movements', 'financial_transactions', 'prescriptions',
      'medical_records', 'consent_templates', 'consent_signatures',
      'tenants', 'subscriptions', 'commissions', 'goals', 'goal_entries',
      'campaigns', 'waitlist', 'notifications', 'chat_messages',
      'documents', 'treatment_plans', 'treatment_plan_items',
      'insurance_plans', 'anamnesis_templates', 'anamnesis_responses',
      'patient_files', 'evolution_records', 'certificates',
      'invoice_items', 'payment_methods', 'rooms', 'check_ins',
      'staff_availability', 'patient_documents'
    ];
    
    for (const t of keyTables) {
      const cols = await p.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
        [t]
      );
      if (cols.rows.length === 0) {
        console.log(`--- ${t}: TABLE DOES NOT EXIST ---`);
      } else {
        console.log(`--- ${t} (${cols.rows.length} cols) ---`);
        console.log(cols.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));
      }
      console.log('');
    }
  } finally {
    await p.end();
  }
})();
