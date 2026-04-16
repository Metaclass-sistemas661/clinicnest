-- Table: report_schedules
-- Domain: 18_reports
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  saved_report_id UUID NOT NULL,
  schedule_type TEXT DEFAULT 'daily' NOT NULL,
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  output_format TEXT DEFAULT 'pdf',
  recipients JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.report_schedules ADD CONSTRAINT report_schedules_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.report_schedules ADD CONSTRAINT report_schedules_saved_report_id_fkey
  FOREIGN KEY (saved_report_id) REFERENCES public.user_saved_reports(id);
