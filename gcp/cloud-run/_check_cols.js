const { Client } = require('pg');
const c = new Client({
  host: '127.0.0.1', port: 9470, database: 'clinicnest',
  user: 'clinicnest_admin', password: 'Andre12@'
});

async function main() {
  await c.connect();

  // Check patients columns
  const patientCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' ORDER BY ordinal_position`);
  console.log('=== patients columns ===');
  patientCols.rows.forEach(r => console.log(' ', r.column_name));

  // Check if date_of_birth or birth_date
  const hasDOB = patientCols.rows.find(r => r.column_name === 'date_of_birth');
  const hasBD = patientCols.rows.find(r => r.column_name === 'birth_date');
  console.log('\ndate_of_birth exists:', !!hasDOB);
  console.log('birth_date exists:', !!hasBD);

  // Check triage_records columns
  const triageCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='triage_records' ORDER BY ordinal_position`);
  console.log('\n=== triage_records columns ===');
  triageCols.rows.forEach(r => console.log(' ', r.column_name));

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
