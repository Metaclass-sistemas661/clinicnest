-- Table: purchase_items
-- Domain: 08_products_inventory
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  purchase_id UUID NOT NULL,
  product_id UUID,
  tenant_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey
  FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);

ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_purchase_items_purchase ON public.purchase_items USING btree (purchase_id);

CREATE INDEX idx_purchase_items_purchase_product ON public.purchase_items USING btree (purchase_id, product_id);
