-- Table: audit_tables_without_rls
CREATE TABLE IF NOT EXISTS audit_tables_without_rls (
  schema_name NAME,
  table_name NAME,
  rls_enabled BOOLEAN,
  rls_forced BOOLEAN
);
