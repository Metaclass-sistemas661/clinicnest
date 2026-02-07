-- Tabela para notificar admin em tempo real quando qualquer agendamento é concluído
-- O RPC completa e insere aqui; admin escuta via Realtime e exibe popup de lucro

CREATE TABLE IF NOT EXISTS public.appointment_completion_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_name TEXT NOT NULL DEFAULT '',
  service_name TEXT NOT NULL DEFAULT 'Serviço',
  service_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
  product_sales JSONB NOT NULL DEFAULT '[]'::jsonb,
  product_profit_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_completion_summaries_tenant 
  ON public.appointment_completion_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_completion_summaries_created 
  ON public.appointment_completion_summaries(created_at);

ALTER TABLE public.appointment_completion_summaries ENABLE ROW LEVEL SECURITY;

-- Admin pode ver resumos do seu tenant
CREATE POLICY "Admin pode ver completion summaries do tenant"
  ON public.appointment_completion_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = appointment_completion_summaries.tenant_id
      AND ur.role = 'admin'
    )
  );

-- Habilitar Realtime: no dashboard Supabase > Database > Replication, adicione a tabela
-- appointment_completion_summaries à publicação supabase_realtime (se não fizer via SQL)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_completion_summaries;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- já está na publicação
END $$;
