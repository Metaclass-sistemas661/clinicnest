-- Tabela para mensagens do formulário de contato (landing page)
-- Usuários não autenticados enviam o formulário via anon key
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: apenas permitir INSERT anônimo (formulário público)
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode enviar mensagem (formulário público)
CREATE POLICY "Anyone can submit contact form"
  ON public.contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Apenas admins/service role podem ler (você consulta no dashboard Supabase)
-- Para ler via app, crie uma função ou policy para authenticated com role admin
CREATE POLICY "Service role can read contact messages"
  ON public.contact_messages
  FOR SELECT
  TO service_role
  USING (true);
