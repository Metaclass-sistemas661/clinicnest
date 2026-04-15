-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (005_inventory)
-- 1 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE TABLE IF NOT EXISTS public.product_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  batch_number TEXT,
  expiry_date DATE,
  zone TEXT,           -- zona de aplicação (face/corpo zone id)
  procedure_type TEXT, -- tipo de procedimento (aesthetic procedure key)
  notes TEXT,
  applied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_usage ENABLE ROW LEVEL SECURITY;

