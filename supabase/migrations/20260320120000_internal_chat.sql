-- Chat Interno: mensagens em tempo real entre membros do tenant
-- Supabase Realtime habilitado nesta tabela

CREATE TABLE IF NOT EXISTS public.internal_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel    TEXT        NOT NULL DEFAULT 'geral',
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_internal_messages_tenant_channel
  ON public.internal_messages (tenant_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_messages_sender
  ON public.internal_messages (sender_id);

-- RLS
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.internal_messages
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "messages_insert" ON public.internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND sender_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- Apenas admin pode deletar mensagens
CREATE POLICY "messages_delete" ON public.internal_messages
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
