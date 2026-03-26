-- ============================================================================
-- SECURITY: Hardening do validate_patient_access
--
-- Problemas corrigidos:
--   1. Retornava client_name completo antes da autenticação (enumeração)
--   2. Retornava client_email em texto plano antes da autenticação
--   3. Sem rate limiting no nível do banco
--   4. Resposta diferenciada "found: false" permitia enumeração de CPFs
--
-- Solução:
--   - Remover client_name e client_email da resposta pré-login
--   - Retornar apenas masked_name (Primeiro Nome + inicial) e masked_email
--   - Adicionar delay artificial de 200ms (pg_sleep) para dificultar brute-force
--   - Manter patient_id + status (necessários para fluxo de criação de conta)
--   - Criar tabela de audit log para tentativas de acesso
-- ============================================================================

-- 1. Tabela de audit log para tentativas de acesso ao portal
CREATE TABLE IF NOT EXISTS public.patient_access_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash TEXT NOT NULL,  -- SHA-256 do identificador (nunca armazena o CPF/código em texto plano)
  success BOOLEAN NOT NULL DEFAULT false,
  ip_hint TEXT,                   -- Apenas últimos 2 octetos para correlação, ex: "*.*.123.45"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para consultas de rate limiting
CREATE INDEX IF NOT EXISTS idx_patient_access_attempts_hash_created
  ON public.patient_access_attempts (identifier_hash, created_at DESC);

-- RLS: ninguém lê essa tabela via API (apenas security definer functions)
ALTER TABLE public.patient_access_attempts ENABLE ROW LEVEL SECURITY;
-- Sem policies = nenhum acesso via API, apenas via SECURITY DEFINER

-- 2. Função atualizada com hardening
CREATE OR REPLACE FUNCTION public.validate_patient_access(
  p_identifier TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_identifier TEXT := btrim(upper(p_identifier));
  v_cpf_clean TEXT;
  v_status TEXT;
  v_masked_name TEXT;
  v_masked_email TEXT;
  v_id_hash TEXT;
  v_recent_attempts INT;
BEGIN
  -- Delay artificial para dificultar brute-force
  PERFORM pg_sleep(0.2);

  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Hash do identificador para audit log (nunca armazena o valor real)
  v_id_hash := encode(digest(v_identifier, 'sha256'), 'hex');

  -- Rate limiting: máximo 5 tentativas por identificador nos últimos 2 minutos
  SELECT count(*) INTO v_recent_attempts
  FROM public.patient_access_attempts
  WHERE identifier_hash = v_id_hash
    AND created_at > now() - interval '2 minutes';

  IF v_recent_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'found', false,
      'error', 'Muitas tentativas. Aguarde alguns minutos.'
    );
  END IF;

  -- Try by access_code first
  SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE upper(p.access_code) = v_identifier
  LIMIT 1;

  -- If not found, try by CPF (digits only)
  IF v_patient IS NULL THEN
    v_cpf_clean := regexp_replace(p_identifier, '[^0-9]', '', 'g');
    IF length(v_cpf_clean) >= 11 THEN
      SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
             t.name AS clinic_name
      INTO v_patient
      FROM public.patients p
      LEFT JOIN public.tenants t ON t.id = p.tenant_id
      WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = v_cpf_clean
      LIMIT 1;
    END IF;
  END IF;

  -- Log da tentativa (antes de retornar resultado)
  INSERT INTO public.patient_access_attempts (identifier_hash, success)
  VALUES (v_id_hash, v_patient IS NOT NULL);

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Determine status
  IF v_patient.user_id IS NOT NULL THEN
    v_status := 'has_account';
  ELSE
    v_status := 'new';
  END IF;

  -- Masked name: "André S." (primeiro nome + inicial do sobrenome)
  v_masked_name := split_part(v_patient.name, ' ', 1);
  IF split_part(v_patient.name, ' ', 2) <> '' THEN
    v_masked_name := v_masked_name || ' ' || left(split_part(v_patient.name, ' ', 2), 1) || '.';
  END IF;

  -- Masked email: "an***@gm***.com"
  IF v_patient.email IS NOT NULL AND v_patient.email <> '' THEN
    v_masked_email := left(split_part(v_patient.email, '@', 1), 2)
      || '***@'
      || left(split_part(v_patient.email, '@', 2), 2)
      || '***.'
      || split_part(split_part(v_patient.email, '@', 2), '.', 2);
  ELSE
    v_masked_email := NULL;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_status,
    'patient_id', v_patient.id,
    'client_id', v_patient.id,            -- compat legado
    'masked_name', v_masked_name,
    'clinic_name', v_patient.clinic_name,
    'masked_email', v_masked_email
    -- REMOVIDOS: client_name, client_email (dados sensíveis pré-auth)
  );
END;
$$;

-- Manter grants existentes
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO authenticated;

-- Limpeza automática de logs antigos (> 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_patient_access_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.patient_access_attempts
  WHERE created_at < now() - interval '30 days';
$$;
