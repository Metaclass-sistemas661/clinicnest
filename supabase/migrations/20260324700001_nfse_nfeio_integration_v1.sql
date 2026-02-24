-- Migration: NFE.io Integration for NFS-e
-- Adds columns to tenants table for NFE.io configuration

-- Add NFE.io configuration columns to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_api_key TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_company_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_active BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_auto_emit BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_default_service_code TEXT DEFAULT '4.03';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nfeio_certificate_expires TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN tenants.nfeio_api_key IS 'API Key from NFE.io account';
COMMENT ON COLUMN tenants.nfeio_company_id IS 'Company ID registered in NFE.io';
COMMENT ON COLUMN tenants.nfeio_active IS 'Whether NFE.io integration is active';
COMMENT ON COLUMN tenants.nfeio_auto_emit IS 'Auto-emit NFS-e when payment is confirmed';
COMMENT ON COLUMN tenants.nfeio_default_service_code IS 'Default service code (LC 116) for NFS-e';
COMMENT ON COLUMN tenants.nfeio_certificate_expires IS 'Expiration date of uploaded A1 certificate';

-- Create table to store emitted NFS-e records
CREATE TABLE IF NOT EXISTS nfse_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- NFE.io reference
  nfeio_invoice_id TEXT NOT NULL,
  nfeio_status TEXT NOT NULL DEFAULT 'pending',
  
  -- Invoice data
  number TEXT,
  check_code TEXT,
  rps_number INTEGER,
  rps_serial TEXT,
  
  -- Borrower (tomador)
  borrower_name TEXT NOT NULL,
  borrower_document TEXT,
  borrower_email TEXT,
  
  -- Service details
  service_code TEXT NOT NULL,
  description TEXT NOT NULL,
  services_amount DECIMAL(12,2) NOT NULL,
  iss_rate DECIMAL(5,4),
  iss_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2) NOT NULL,
  
  -- Related records
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Timestamps
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- PDF/XML storage
  pdf_url TEXT,
  xml_url TEXT,
  
  -- Error tracking
  error_message TEXT,
  
  UNIQUE(tenant_id, nfeio_invoice_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_tenant ON nfse_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_status ON nfse_invoices(nfeio_status);
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_payment ON nfse_invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_client ON nfse_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_issued ON nfse_invoices(issued_at);

-- RLS
ALTER TABLE nfse_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for nfse_invoices" ON nfse_invoices;
CREATE POLICY "Tenant isolation for nfse_invoices"
  ON nfse_invoices
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_nfse_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nfse_invoices_updated_at ON nfse_invoices;
CREATE TRIGGER trigger_nfse_invoices_updated_at
  BEFORE UPDATE ON nfse_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_nfse_invoices_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON nfse_invoices TO authenticated;
