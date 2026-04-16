-- Table: report_definitions
-- Domain: 18_reports
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.report_definitions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category REPORT_CATEGORY DEFAULT 'custom' NOT NULL,
  is_template BOOLEAN DEFAULT false,
  template_id UUID,
  base_table VARCHAR(100) NOT NULL,
  joins JSONB DEFAULT '[]',
  fields JSONB DEFAULT '[]' NOT NULL,
  default_filters JSONB DEFAULT '[]',
  group_by JSONB DEFAULT '[]',
  order_by JSONB DEFAULT '[]',
  chart_type REPORT_CHART_TYPE DEFAULT 'none',
  chart_config JSONB DEFAULT '{}',
  icon VARCHAR(50),
  color VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.report_definitions ADD CONSTRAINT report_definitions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.report_definitions ADD CONSTRAINT report_definitions_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.report_definitions(id);
