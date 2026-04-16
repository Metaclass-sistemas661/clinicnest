-- Table: product_categories
-- Domain: 08_products_inventory
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_product_categories_tenant_id ON public.product_categories USING btree (tenant_id);
