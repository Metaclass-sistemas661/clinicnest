const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: 'postgresql://clinicnest_admin:Andre12%40@127.0.0.1:9470/clinicnest' });

(async () => {
  // 1. Tables in DB
  const dbResult = await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const dbTables = new Set(dbResult.rows.map(r => r.tablename));

  // 2. Tables in migration files
  const migrDir = path.join(__dirname, '..', 'migrations');
  const migTables = new Set();
  
  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) scanDir(path.join(dir, entry.name));
      else if (entry.name.endsWith('.sql')) {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        const matches = content.matchAll(/CREATE TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?(\w+)/gi);
        for (const m of matches) migTables.add(m[1].toLowerCase());
      }
    }
  }
  scanDir(migrDir);

  // 3. Compare
  const inDbNotMig = [...dbTables].filter(t => !migTables.has(t)).sort();
  const inMigNotDb = [...migTables].filter(t => !dbTables.has(t)).sort();
  const inBoth = [...dbTables].filter(t => migTables.has(t)).sort();

  console.log(`\n=== RESUMO ===`);
  console.log(`Tabelas no BANCO (Cloud SQL): ${dbTables.size}`);
  console.log(`Tabelas nos MIGRATIONS (arquivos): ${migTables.size}`);
  console.log(`Em AMBOS (ok): ${inBoth.length}`);
  console.log(`No BANCO mas NÃO nos migrations: ${inDbNotMig.length}`);
  console.log(`Nos MIGRATIONS mas NÃO no banco: ${inMigNotDb.length}`);

  if (inDbNotMig.length) {
    console.log(`\n--- No BANCO mas SEM migration (${inDbNotMig.length}) ---`);
    inDbNotMig.forEach(t => console.log(`  - ${t}`));
  }
  if (inMigNotDb.length) {
    console.log(`\n--- Nos MIGRATIONS mas NÃO no banco (${inMigNotDb.length}) ---`);
    inMigNotDb.forEach(t => console.log(`  - ${t}`));
  }

  await p.end();
})();
