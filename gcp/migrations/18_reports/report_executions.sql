-- Table: report_executions
-- Domain: 18_reports
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.report_executions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  report_definition_id UUID,
  saved_report_id UUID,
  schedule_id UUID,
  status TEXT DEFAULT 'pending' NOT NULL,
  parameters JSONB DEFAULT '{}',
  result_url TEXT,
  error_message TEXT,
  rows_count INTEGER,
  execution_time_ms INTEGER,
  output_format TEXT DEFAULT 'pdf',
  file_size_bytes BIGINT,
  executed_by UUID,
  executed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.report_executions ADD CONSTRAINT report_executions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.report_executions ADD CONSTRAINT report_executions_report_definition_id_fkey
  FOREIGN KEY (report_definition_id) REFERENCES public.report_definitions(id);

ALTER TABLE public.report_executions ADD CONSTRAINT report_executions_saved_report_id_fkey
  FOREIGN KEY (saved_report_id) REFERENCES public.user_saved_reports(id);

ALTER TABLE public.report_executions ADD CONSTRAINT report_executions_schedule_id_fkey
  FOREIGN KEY (schedule_id) REFERENCES public.report_schedules(id);
