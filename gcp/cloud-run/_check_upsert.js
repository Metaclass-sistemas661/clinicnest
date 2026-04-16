const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  // Check for existing upsert functions
  const r = await p.query(`
    SELECT routine_name, routine_type
    FROM information_schema.routines 
    WHERE routine_schema='public' 
    AND (routine_name LIKE '%upsert_client%' OR routine_name LIKE '%upsert_patient%')
    ORDER BY routine_name
  `);
  console.log('Funções upsert encontradas:', r.rows.length);
  r.rows.forEach(x => console.log(' -', x.routine_name, `(${x.routine_type})`));

  // Also check what columns patients table has
  const cols = await p.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='patients'
    ORDER BY ordinal_position
  `);
  console.log('\nColunas da tabela patients:');
  cols.rows.forEach(c => console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''} ${c.column_default || ''}`));

  await p.end();
})();
