-- Guias TISS: faturamento eletrônico para operadoras de plano de saúde (ANS)

CREATE TABLE IF NOT EXISTS public.tiss_guides (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insurance_plan_id UUID       REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
  appointment_id   UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  lot_number       TEXT        NOT NULL,
  guide_number     TEXT        NOT NULL,
  guide_type       TEXT        NOT NULL DEFAULT 'consulta', -- consulta | sadt
  -- status: pending (gerada) | submitted (enviada) | accepted (aceita) | rejected (rejeitada)
  status           TEXT        NOT NULL DEFAULT 'pending',
  xml_content      TEXT,
  tiss_version     TEXT        NOT NULL DEFAULT '3.05.00',
  submitted_at     TIMESTAMPTZ,
  response_code    TEXT,
  response_message TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tiss_guides_tenant_id         ON public.tiss_guides (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tiss_guides_insurance_plan_id ON public.tiss_guides (insurance_plan_id);
CREATE INDEX IF NOT EXISTS idx_tiss_guides_lot_number        ON public.tiss_guides (tenant_id, lot_number);
CREATE INDEX IF NOT EXISTS idx_tiss_guides_status            ON public.tiss_guides (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tiss_guides_appointment_id    ON public.tiss_guides (appointment_id);

-- RLS
ALTER TABLE public.tiss_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiss_guides FORCE ROW LEVEL SECURITY;

CREATE POLICY "tiss_select" ON public.tiss_guides
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "tiss_insert" ON public.tiss_guides
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "tiss_update" ON public.tiss_guides
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "tiss_delete" ON public.tiss_guides
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));
