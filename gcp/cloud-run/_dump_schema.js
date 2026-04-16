const { Client } = require('pg');
const fs = require('fs');

const c = new Client({
  host: '127.0.0.1',
  port: 9470,
  database: 'clinicnest',
  user: 'clinicnest_admin',
  password: 'Andre12@'
});

async function main() {
  await c.connect();

  // Get all tables
  const tables = await c.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  console.log(`Total tables: ${tables.rows.length}\n`);

  const allDDL = [];

  for (const { table_name } of tables.rows) {
    // Get columns
    const cols = await c.query(`
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        is_nullable, 
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table_name]);

    // Get primary key
    const pk = await c.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.table_name = $1 
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [table_name]);

    // Get foreign keys
    const fks = await c.query(`
      SELECT 
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.table_name = $1 
        AND tc.constraint_type = 'FOREIGN KEY'
    `, [table_name]);

    // Get unique constraints
    const uq = await c.query(`
      SELECT kcu.column_name, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.table_name = $1 
        AND tc.constraint_type = 'UNIQUE'
    `, [table_name]);

    // Get indexes
    const idx = await c.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = $1
      ORDER BY indexname
    `, [table_name]);

    // Build DDL
    let ddl = `-- Table: ${table_name}\nCREATE TABLE IF NOT EXISTS ${table_name} (\n`;
    
    const colDefs = cols.rows.map(col => {
      let type = col.udt_name;
      // Map udt names to proper SQL types
      if (type === 'uuid') type = 'UUID';
      else if (type === 'text') type = 'TEXT';
      else if (type === 'int4') type = 'INTEGER';
      else if (type === 'int8') type = 'BIGINT';
      else if (type === 'int2') type = 'SMALLINT';
      else if (type === 'float4') type = 'REAL';
      else if (type === 'float8') type = 'DOUBLE PRECISION';
      else if (type === 'bool') type = 'BOOLEAN';
      else if (type === 'timestamptz') type = 'TIMESTAMPTZ';
      else if (type === 'timestamp') type = 'TIMESTAMP';
      else if (type === 'date') type = 'DATE';
      else if (type === 'time') type = 'TIME';
      else if (type === 'timetz') type = 'TIMETZ';
      else if (type === 'jsonb') type = 'JSONB';
      else if (type === 'json') type = 'JSON';
      else if (type === 'numeric') {
        if (col.numeric_precision && col.numeric_scale) 
          type = `NUMERIC(${col.numeric_precision},${col.numeric_scale})`;
        else type = 'NUMERIC';
      }
      else if (type === 'varchar') type = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR';
      else if (type === '_text') type = 'TEXT[]';
      else if (type === '_uuid') type = 'UUID[]';
      else if (type === '_int4') type = 'INTEGER[]';
      else if (type === '_varchar') type = 'VARCHAR[]';
      else type = type.toUpperCase();

      let def = `  ${col.column_name} ${type}`;
      if (col.is_nullable === 'NO') def += ' NOT NULL';
      if (col.column_default) def += ` DEFAULT ${col.column_default}`;
      return def;
    });

    ddl += colDefs.join(',\n');

    // Add PK
    if (pk.rows.length > 0) {
      const pkCols = pk.rows.map(r => r.column_name).join(', ');
      ddl += `,\n  PRIMARY KEY (${pkCols})`;
    }

    ddl += '\n);\n';

    // Add FKs as ALTER TABLE
    for (const fk of fks.rows) {
      ddl += `\n-- FK: ${fk.constraint_name}\n`;
      ddl += `-- ALTER TABLE ${table_name} ADD CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table}(${fk.foreign_column});\n`;
    }

    // Add indexes (skip pkey indexes)
    for (const ix of idx.rows) {
      if (ix.indexname.endsWith('_pkey')) continue;
      ddl += `\n${ix.indexdef};\n`;
    }

    ddl += '\n';
    allDDL.push(ddl);
    console.log(`  ✓ ${table_name} (${cols.rows.length} columns)`);
  }

  // Write complete schema to file
  const output = `-- ============================================\n-- ClinicaFlow / ClinicNest — Complete Cloud SQL Schema\n-- Generated: ${new Date().toISOString()}\n-- Database: clinicnest\n-- ============================================\n\n` + allDDL.join('\n');
  
  fs.writeFileSync('_full_schema.sql', output);
  console.log(`\nSchema written to _full_schema.sql`);

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
