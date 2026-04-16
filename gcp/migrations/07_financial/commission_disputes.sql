-- Table: commission_disputes
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.commission_disputes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  commission_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  admin_response TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.commission_disputes ADD CONSTRAINT commission_disputes_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.commission_disputes ADD CONSTRAINT commission_disputes_commission_id_fkey
  FOREIGN KEY (commission_id) REFERENCES public.commission_payments(id);

ALTER TABLE public.commission_disputes ADD CONSTRAINT commission_disputes_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(user_id);

ALTER TABLE public.commission_disputes ADD CONSTRAINT commission_disputes_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES public.profiles(user_id);
