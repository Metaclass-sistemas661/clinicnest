-- Produtos: preço de venda (margem calculada no app)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.sale_price IS 'Preço de venda ao cliente; margem = (sale_price - cost) / cost * 100';

-- Movimentações: motivo da saída (venda = gera receita; danificado = só histórico)
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS out_reason_type TEXT NULL
  CHECK (out_reason_type IS NULL OR out_reason_type IN ('sale', 'damaged'));

COMMENT ON COLUMN public.stock_movements.out_reason_type IS 'Para movement_type=out: sale = venda (gera receita); damaged = baixa danificado (só histórico)';

-- Financeiro: vínculo com produto (compra = despesa; venda = receita)
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_product_id ON public.financial_transactions(product_id);

COMMENT ON COLUMN public.financial_transactions.product_id IS 'Preenchido quando transação é compra ou venda de produto';
