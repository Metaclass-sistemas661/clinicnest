-- Table: user_saved_reports
-- Domain: 18_reports
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.user_saved_reports (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  report_definition_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  custom_filters JSONB DEFAULT '[]',
  custom_fields JSONB,
  custom_group_by JSONB,
  custom_chart_config JSONB,
  is_favorite BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.user_saved_reports ADD CONSTRAINT user_saved_reports_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.user_saved_reports ADD CONSTRAINT user_saved_reports_report_definition_id_fkey
  FOREIGN KEY (report_definition_id) REFERENCES public.report_definitions(id);
