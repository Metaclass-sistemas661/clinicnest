-- Table: sbis_documentation
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sbis_documentation (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  requirement_code VARCHAR(20),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  content TEXT,
  evidence_type VARCHAR(50),
  evidence_url TEXT,
  screenshots JSONB DEFAULT '[]',
  compliance_status VARCHAR(20) DEFAULT 'pending',
  compliance_notes TEXT,
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.sbis_documentation ADD CONSTRAINT sbis_documentation_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
