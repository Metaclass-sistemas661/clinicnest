-- P5: Performance indexes for core queries (appointments scheduling, financial, stock)

-- Appointments: speed up calendar listing and conflict checks
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_scheduled_at
  ON public.appointments (tenant_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_professional_scheduled_at
  ON public.appointments (tenant_id, professional_id, scheduled_at);

-- Useful partial index for non-cancelled conflict checks/listings
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_professional_scheduled_at_not_cancelled
  ON public.appointments (tenant_id, professional_id, scheduled_at)
  WHERE status <> 'cancelled';

-- Financial transactions: month filtering and ordering
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_transaction_date
  ON public.financial_transactions (tenant_id, transaction_date DESC);

-- If you often filter by type/category in reports
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_type_date
  ON public.financial_transactions (tenant_id, type, transaction_date DESC);

-- Stock movements: product history and damaged reports
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created_at
  ON public.stock_movements (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product_created_at
  ON public.stock_movements (tenant_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_out_reason_created_at
  ON public.stock_movements (tenant_id, out_reason_type, created_at DESC)
  WHERE movement_type = 'out';
