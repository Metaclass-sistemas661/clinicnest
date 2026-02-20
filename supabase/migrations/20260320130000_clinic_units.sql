-- Multi-unidade: suporte a múltiplas filiais/unidades dentro de um tenant

CREATE TABLE IF NOT EXISTS public.clinic_units (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  phone          TEXT,
  address_street TEXT,
  address_city   TEXT,
  address_state  CHAR(2),
  address_zip    TEXT,
  cnes_code      TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER update_clinic_units_updated_at
  BEFORE UPDATE ON public.clinic_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_clinic_units_tenant_id ON public.clinic_units (tenant_id);

-- RLS
ALTER TABLE public.clinic_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_units FORCE ROW LEVEL SECURITY;

CREATE POLICY "units_select" ON public.clinic_units
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "units_insert" ON public.clinic_units
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "units_update" ON public.clinic_units
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "units_delete" ON public.clinic_units
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Associar unidade ao agendamento (opcional)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.clinic_units(id) ON DELETE SET NULL;

-- Unidade padrão do profissional
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_unit_id UUID REFERENCES public.clinic_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_unit_id ON public.appointments (unit_id);
