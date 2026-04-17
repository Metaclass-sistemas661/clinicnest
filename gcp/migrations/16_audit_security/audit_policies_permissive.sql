-- Table: audit_policies_permissive
CREATE TABLE IF NOT EXISTS audit_policies_permissive (
  schema_name NAME,
  table_name NAME,
  policy_name NAME,
  command TEXT,
  using_expression TEXT,
  with_check_expression TEXT
);
