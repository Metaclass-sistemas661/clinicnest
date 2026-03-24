-- ── Tabela para códigos de verificação de e-mail (OTP) ──────────────────────
-- Armazena códigos de 6 dígitos enviados por e-mail durante o cadastro.
-- Registros expiram automaticamente e são limpos por cron/trigger.

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  code       text NOT NULL,
  attempts   int  NOT NULL DEFAULT 0,
  verified   boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca rápida por user_id + código
CREATE INDEX IF NOT EXISTS idx_evc_user_id ON public.email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_evc_email   ON public.email_verification_codes(email);

-- RLS: somente service_role acessa (edge functions)
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy pública — acesso exclusivo via service_role_key nas edge functions
-- Permitir o trigger de auth acessar caso necessário
CREATE POLICY "service_role_full_access"
  ON public.email_verification_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Limpar códigos expirados (pode ser chamado por cron ou pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.email_verification_codes
  WHERE expires_at < now() - interval '1 hour';
$$;
