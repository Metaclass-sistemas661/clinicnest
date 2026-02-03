-- Product categories for grouping products
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_tenant_name_unique UNIQUE (tenant_id, name)
);

COMMENT ON TABLE public.product_categories IS 'Categorias personalizadas para organizar produtos por salão.';
COMMENT ON COLUMN public.product_categories.tenant_id IS 'Vincula a categoria ao salão (tenant).';
COMMENT ON COLUMN public.product_categories.name IS 'Nome da categoria de produto definido pelo salão.';

CREATE INDEX IF NOT EXISTS idx_product_categories_tenant_id
  ON public.product_categories(tenant_id);

-- Link products with categories
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id UUID NULL REFERENCES public.product_categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.products.category_id IS 'Categoria opcional do produto.';

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products(category_id);

-- Enable and configure RLS for product categories
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_categories'
  ) THEN
    -- View policies
    CREATE POLICY "Users can view product categories in their tenant"
    ON public.product_categories FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

    -- Insert policies (admins only)
    CREATE POLICY "Admins can create product categories in their tenant"
    ON public.product_categories FOR INSERT
    TO authenticated
    WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

    -- Update policies (admins only)
    CREATE POLICY "Admins can update product categories in their tenant"
    ON public.product_categories FOR UPDATE
    TO authenticated
    USING (public.is_tenant_admin(auth.uid(), tenant_id))
    WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

    -- Delete policies (admins only)
    CREATE POLICY "Admins can delete product categories in their tenant"
    ON public.product_categories FOR DELETE
    TO authenticated
    USING (public.is_tenant_admin(auth.uid(), tenant_id));
  END IF;
END;
$$ LANGUAGE plpgsql;
