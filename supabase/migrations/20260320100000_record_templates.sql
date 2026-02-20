-- Prontuário Personalizável: templates de campos por especialidade

CREATE TABLE IF NOT EXISTS public.record_field_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  specialty_id UUID        REFERENCES public.specialties(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  -- fields JSONB: [{name, label, type, required, options?, placeholder?}]
  -- type: text | textarea | number | date | select | boolean
  fields       JSONB       NOT NULL DEFAULT '[]',
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER update_record_field_templates_updated_at
  BEFORE UPDATE ON public.record_field_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_rft_tenant_id     ON public.record_field_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rft_specialty_id  ON public.record_field_templates (specialty_id);

-- RLS
ALTER TABLE public.record_field_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_field_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY "rft_select" ON public.record_field_templates
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "rft_insert" ON public.record_field_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "rft_update" ON public.record_field_templates
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "rft_delete" ON public.record_field_templates
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Adicionar coluna custom_fields na tabela medical_records
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
