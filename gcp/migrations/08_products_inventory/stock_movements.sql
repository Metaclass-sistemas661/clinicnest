-- Table: stock_movements
-- Domain: 08_products_inventory
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  reason TEXT,
  created_by UUID,
  batch_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  out_reason_type TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id);

CREATE INDEX idx_stock_movements_batch ON public.stock_movements USING btree (batch_number) WHERE (batch_number IS NOT NULL);

CREATE INDEX idx_stock_movements_product ON public.stock_movements USING btree (product_id);

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);

CREATE INDEX idx_stock_movements_tenant_created_at ON public.stock_movements USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_stock_movements_tenant_id ON public.stock_movements USING btree (tenant_id);

CREATE INDEX idx_stock_movements_tenant_product_created_at ON public.stock_movements USING btree (tenant_id, product_id, created_at DESC);
