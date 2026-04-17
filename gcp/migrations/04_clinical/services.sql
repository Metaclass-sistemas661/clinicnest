-- Table: services
CREATE TABLE IF NOT EXISTS services (
  id UUID,
  tenant_id UUID,
  name TEXT,
  description TEXT,
  duration_minutes INTEGER,
  price NUMERIC(10,2),
  cost NUMERIC(10,2),
  commission_type COMMISSION_TYPE,
  commission_value NUMERIC(10,2),
  category TEXT,
  tuss_code TEXT,
  is_active BOOLEAN,
  requires_authorization BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
