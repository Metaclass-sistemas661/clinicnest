const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  const r = await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('TOTAL TABELAS NO BANCO:', r.rows.length);
  r.rows.forEach(x => console.log(x.tablename));
  await p.end();
})();
