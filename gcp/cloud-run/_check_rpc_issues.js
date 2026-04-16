const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  // 1. Check helper functions
  const helpers = await p.query(`
    SELECT proname FROM pg_proc 
    WHERE pronamespace = 'public'::regnamespace 
    AND proname IN ('raise_app_error', 'log_tenant_action', 'is_tenant_admin')
  `);
  console.log('=== Helper functions ===');
  helpers.rows.forEach(r => console.log(' ✓', r.proname));

  // 2. Check if 'clients' table/view exists
  const clientsCheck = await p.query(`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='clients'
    UNION ALL
    SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname='clients'
  `);
  console.log('\n=== Tabela/view "clients" ===');
  console.log(clientsCheck.rows.length > 0 ? ' Existe!' : ' NÃO existe — precisa ser patients');

  // 3. List all public functions that reference 'clients' in source
  const funcsWithClients = await p.query(`
    SELECT proname 
    FROM pg_proc 
    WHERE pronamespace = 'public'::regnamespace 
    AND prosrc LIKE '%public.clients%'
    ORDER BY proname
  `);
  console.log('\n=== Funções que referenciam public.clients (tabela antiga) ===');
  funcsWithClients.rows.forEach(r => console.log(' -', r.proname));

  // 4. All RPCs called from frontend
  const allFuncs = await p.query(`
    SELECT proname FROM pg_proc 
    WHERE pronamespace = 'public'::regnamespace 
    AND proname LIKE '%_v%'
    ORDER BY proname
  `);
  console.log('\n=== Funções _v* (versioned RPCs) ===');
  allFuncs.rows.forEach(r => console.log(' -', r.proname));

  await p.end();
})();
