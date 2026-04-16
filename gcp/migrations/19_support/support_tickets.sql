-- Table: support_tickets
-- Domain: 19_support
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_support_tickets_tenant ON public.support_tickets USING btree (tenant_id);

CREATE INDEX support_tickets_tenant_id_idx ON public.support_tickets USING btree (tenant_id);
