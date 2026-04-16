-- Table: notification_logs
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  recipient_type TEXT DEFAULT 'patient' NOT NULL,
  recipient_id UUID,
  channel TEXT NOT NULL,
  template_type TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  metadata JSONB DEFAULT '{}',
  error_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
