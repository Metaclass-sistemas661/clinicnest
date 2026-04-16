const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  try {
    const r1 = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='stock_movements' ORDER BY ordinal_position");
    console.log('stock_movements columns:', r1.rows.map(x => x.column_name));

    const r2 = await p.query("SELECT to_regclass('public.financial_transactions')");
    console.log('financial_transactions exists:', r2.rows[0].to_regclass);
  } finally {
    await p.end();
  }
})();
