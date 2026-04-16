-- Table: order_items
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  order_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id);

ALTER TABLE public.order_items ADD CONSTRAINT order_items_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);

CREATE INDEX idx_order_items_tenant ON public.order_items USING btree (tenant_id);
