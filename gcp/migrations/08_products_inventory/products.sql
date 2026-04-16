-- Table: products
-- Domain: 08_products_inventory
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  cost NUMERIC DEFAULT 0 NOT NULL,
  sale_price NUMERIC DEFAULT 0,
  quantity INTEGER DEFAULT 0 NOT NULL,
  min_quantity INTEGER DEFAULT 5 NOT NULL,
  category_id UUID,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_controlled BOOLEAN DEFAULT false,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.products ADD CONSTRAINT products_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_products_category ON public.products USING btree (category_id);

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);

CREATE INDEX idx_products_tenant_id ON public.products USING btree (tenant_id);
