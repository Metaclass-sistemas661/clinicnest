-- Table: bills_payable
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.bills_payable (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_at DATE,
  status TEXT DEFAULT 'pending',
  category TEXT,
  supplier_id UUID,
  cost_center_id UUID,
  recurrence TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID,
  is_recurring BOOLEAN DEFAULT false NOT NULL,
  notes TEXT,
  paid_amount NUMERIC,
  payment_method TEXT,
  recurrence_type TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.bills_payable ADD CONSTRAINT bills_payable_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.bills_payable ADD CONSTRAINT bills_payable_cost_center_id_fkey
  FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);

ALTER TABLE public.bills_payable ADD CONSTRAINT bills_payable_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);

CREATE INDEX idx_bills_payable_tenant ON public.bills_payable USING btree (tenant_id);
