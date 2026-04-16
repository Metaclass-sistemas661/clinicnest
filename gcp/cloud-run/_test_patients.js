const { Client } = require('pg');
const c = new Client({
  host: '127.0.0.1',
  port: 9470,
  database: 'clinicnest',
  user: 'clinicnest_admin',
  password: 'Andre12@'
});

async function main() {
  await c.connect();
  
  // Reproduce the exact query from Pacientes.tsx
  const tenantId = 'ca5bec59-ef80-4497-a358-98bbcdd2a0a2';
  
  try {
    const result = await c.query(
      `SELECT id,tenant_id,name,phone,email,notes,cpf,access_code,date_of_birth,marital_status,zip_code,street,street_number,complement,neighborhood,city,state,allergies,created_at,updated_at FROM "patients" WHERE "tenant_id" = $1 ORDER BY "name" ASC`,
      [tenantId]
    );
    console.log('SUCCESS! Rows:', result.rows.length);
    if (result.rows.length > 0) console.log('First row keys:', Object.keys(result.rows[0]));
  } catch (err) {
    console.error('QUERY ERROR:', err.message);
    console.error('Code:', err.code);
    
    // Check which columns exist
    const cols = await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' ORDER BY ordinal_position`
    );
    console.log('\nActual columns in patients table:');
    cols.rows.forEach(r => console.log(' -', r.column_name));
  }
  
  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
