const { Client } = require('pg');
const c = new Client({
  host: '127.0.0.1', port: 9470, database: 'clinicnest',
  user: 'clinicnest_admin', password: 'Andre12@'
});

async function main() {
  await c.connect();
  
  await c.query(`ALTER TABLE triage_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`);
  console.log('triage_records.updated_at added');

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
