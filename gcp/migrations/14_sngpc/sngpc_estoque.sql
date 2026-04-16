-- Table: sngpc_estoque
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_estoque (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  product_id UUID,
  substance_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'comprimido',
  batch_number TEXT,
  expiry_date DATE,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_estoque ADD CONSTRAINT sngpc_estoque_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.sngpc_estoque ADD CONSTRAINT sngpc_estoque_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id);

CREATE INDEX idx_sngpc_estoque_tenant ON public.sngpc_estoque USING btree (tenant_id);
