-- ============================================================================
-- Migration: 20260703800000_tenant_email_reply_to_v1
--
-- Adiciona campo email_reply_to na tabela tenants para que emails enviados
-- pela plataforma em nome da clínica usem Reply-To com o email da clínica.
--
-- Remetente: "Nome da Clínica" <notificacoes@metaclass.com.br>
-- Reply-To:  contato@clinicaabc.com.br  (o que a clínica configurar)
-- ============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS email_reply_to TEXT;

COMMENT ON COLUMN public.tenants.email_reply_to IS
  'Email de contato da clínica usado como Reply-To nos emails enviados em nome dela';
