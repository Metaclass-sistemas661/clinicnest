const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  try {
    const alters = [
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status TEXT',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS street TEXT',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS street_number TEXT',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS complement TEXT',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS neighborhood TEXT',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_plan_id UUID',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_card_number TEXT',
    ];
    for (const sql of alters) {
      await p.query(sql);
    }
    console.log('All missing columns added to patients');

    const r = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='patients' ORDER BY ordinal_position");
    console.log('patients columns now:', r.rows.map(x => x.column_name));
  } finally {
    await p.end();
  }
})();
