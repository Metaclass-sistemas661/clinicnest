-- Fase 3: Campos de glosa e recurso na tabela tiss_guides + tabela tiss_glosa_appeals

ALTER TABLE public.tiss_guides
  ADD COLUMN IF NOT EXISTS glosa_code        TEXT,
  ADD COLUMN IF NOT EXISTS glosa_description TEXT,
  ADD COLUMN IF NOT EXISTS glosa_value       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS released_value    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS return_xml        TEXT,
  ADD COLUMN IF NOT EXISTS return_parsed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_value       NUMERIC(12,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.tiss_glosa_appeals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiss_guide_id     UUID        NOT NULL REFERENCES public.tiss_guides(id) ON DELETE CASCADE,
  appeal_number     TEXT        NOT NULL,
  justification     TEXT        NOT NULL,
  requested_value   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'pending',
  response_text     TEXT,
  resolved_value    NUMERIC(12,2),
  submitted_at      TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glosa_appeals_tenant   ON public.tiss_glosa_appeals (tenant_id);
CREATE INDEX IF NOT EXISTS idx_glosa_appeals_guide    ON public.tiss_glosa_appeals (tiss_guide_id);
CREATE INDEX IF NOT EXISTS idx_glosa_appeals_status   ON public.tiss_glosa_appeals (tenant_id, status);

ALTER TABLE public.tiss_glosa_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiss_glosa_appeals FORCE ROW LEVEL SECURITY;

CREATE POLICY "glosa_appeals_select" ON public.tiss_glosa_appeals
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "glosa_appeals_insert" ON public.tiss_glosa_appeals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "glosa_appeals_update" ON public.tiss_glosa_appeals
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "glosa_appeals_delete" ON public.tiss_glosa_appeals
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));
