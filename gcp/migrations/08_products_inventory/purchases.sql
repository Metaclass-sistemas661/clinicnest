-- Table: purchases
-- Domain: 08_products_inventory
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  supplier_id UUID,
  total NUMERIC DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  invoice_number TEXT,
  purchase_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.purchases ADD CONSTRAINT purchases_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.purchases ADD CONSTRAINT purchases_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

CREATE INDEX idx_purchases_tenant_id ON public.purchases USING btree (tenant_id);
