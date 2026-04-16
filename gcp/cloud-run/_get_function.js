const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  // Get function source
  const r = await p.query(`
    SELECT pg_get_functiondef(oid) as def
    FROM pg_proc 
    WHERE proname = 'upsert_client_v2' AND pronamespace = 'public'::regnamespace
  `);
  if (r.rows.length) {
    console.log(r.rows[0].def);
  } else {
    console.log('Função não encontrada');
  }

  await p.end();
})();
