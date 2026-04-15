-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (006_odontology)
-- 3 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE TABLE IF NOT EXISTS public.dental_prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  periogram_id    UUID REFERENCES public.periograms(id) ON DELETE SET NULL,
  odontogram_id   UUID REFERENCES public.odontograms(id) ON DELETE SET NULL,
  
  -- Prescrição
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis       TEXT,
  medications     JSONB NOT NULL DEFAULT '[]',  -- [{name, dosage, frequency, duration, instructions}]
  instructions    TEXT,
  
  -- Assinatura
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_by_cro   TEXT,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dental_prescriptions ENABLE ROW LEVEL SECURITY;

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE TABLE IF NOT EXISTS public.odontogram_tooth_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odontogram_id   UUID NOT NULL REFERENCES public.odontograms(id) ON DELETE CASCADE,
  tooth_number    INTEGER NOT NULL,
  
  -- O que mudou
  previous_condition TEXT,
  new_condition      TEXT NOT NULL,
  previous_surfaces  TEXT,
  new_surfaces       TEXT,
  previous_notes     TEXT,
  new_notes          TEXT,
  
  -- Quem e quando
  changed_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason   TEXT,
  
  -- Metadados
  ip_address      TEXT,
  user_agent      TEXT
);

ALTER TABLE public.odontogram_tooth_history ENABLE ROW LEVEL SECURITY;

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE TABLE IF NOT EXISTS public.tuss_odonto_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tuss_code     TEXT NOT NULL,
  description   TEXT NOT NULL,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, tuss_code)
);

ALTER TABLE public.tuss_odonto_prices ENABLE ROW LEVEL SECURITY;

