-- ============================================================
-- FASE 48: Assinatura Digital ICP-Brasil Completa
-- Arquivo: 20260330700000_profile_certificates_v1.sql
-- Descrição: Tabela para armazenar certificados digitais cadastrados
--            por profissional, permitindo assinatura simplificada
-- ============================================================

-- ============================================================
-- 1. ENUM: Tipo de Certificado Digital
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.certificate_type AS ENUM (
    'A1',     -- Arquivo .pfx/.p12 (armazenado criptografado)
    'A3',     -- Token/Cartão (referência via WebPKI)
    'cloud'   -- Certificado em nuvem (BirdID, CertiSign, etc.)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.certificate_type IS 'Tipos de certificado digital ICP-Brasil suportados';

-- ============================================================
-- 2. TABELA: Certificados Digitais por Profissional
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Tipo de certificado
  certificate_type public.certificate_type NOT NULL DEFAULT 'A1',
  
  -- Dados do certificado (extraídos do X.509)
  common_name TEXT NOT NULL,
  cpf_cnpj TEXT,
  issuer TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  not_before TIMESTAMPTZ NOT NULL,
  not_after TIMESTAMPTZ NOT NULL,
  thumbprint TEXT NOT NULL,
  
  -- Para A1: certificado criptografado (AES-256-GCM)
  encrypted_pfx BYTEA,
  encryption_iv BYTEA,
  encryption_salt BYTEA,
  
  -- Para A3: apenas referência (certificado fica no token)
  a3_thumbprint TEXT,
  
  -- Para cloud: credenciais OAuth
  cloud_provider TEXT,
  cloud_credential_id TEXT,
  cloud_access_token TEXT,
  cloud_refresh_token TEXT,
  cloud_token_expires_at TIMESTAMPTZ,
  
  -- Metadados
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT unique_profile_thumbprint UNIQUE(profile_id, thumbprint)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profile_certificates_profile 
  ON public.profile_certificates(profile_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_profile_certificates_tenant 
  ON public.profile_certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profile_certificates_default 
  ON public.profile_certificates(profile_id, is_default) WHERE is_default;

-- RLS
ALTER TABLE public.profile_certificates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "profile_certificates_select" ON public.profile_certificates;
CREATE POLICY "profile_certificates_select" ON public.profile_certificates
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "profile_certificates_insert" ON public.profile_certificates;
CREATE POLICY "profile_certificates_insert" ON public.profile_certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "profile_certificates_update" ON public.profile_certificates;
CREATE POLICY "profile_certificates_update" ON public.profile_certificates
  FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "profile_certificates_delete" ON public.profile_certificates;
CREATE POLICY "profile_certificates_delete" ON public.profile_certificates
  FOR DELETE TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Comentários
COMMENT ON TABLE public.profile_certificates IS 'Certificados digitais ICP-Brasil cadastrados por profissional';
COMMENT ON COLUMN public.profile_certificates.encrypted_pfx IS 'Arquivo .pfx criptografado com AES-256-GCM (apenas A1)';
COMMENT ON COLUMN public.profile_certificates.encryption_iv IS 'IV usado na criptografia AES';
COMMENT ON COLUMN public.profile_certificates.encryption_salt IS 'Salt usado na derivação da chave';
COMMENT ON COLUMN public.profile_certificates.is_default IS 'Certificado padrão para assinaturas';
COMMENT ON COLUMN public.profile_certificates.thumbprint IS 'Hash SHA-1 do certificado (identificador único)';

-- ============================================================
-- 3. TRIGGER: Garantir apenas um certificado padrão por perfil
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_single_default_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.profile_certificates
    SET is_default = false, updated_at = NOW()
    WHERE profile_id = NEW.profile_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_single_default_certificate ON public.profile_certificates;
CREATE TRIGGER trg_ensure_single_default_certificate
  BEFORE INSERT OR UPDATE ON public.profile_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_certificate();

-- ============================================================
-- 4. TRIGGER: Atualizar updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_profile_certificates_updated_at ON public.profile_certificates;
CREATE TRIGGER trg_profile_certificates_updated_at
  BEFORE UPDATE ON public.profile_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. RPC: Registrar Certificado A1
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_certificate_a1(
  p_common_name TEXT,
  p_cpf_cnpj TEXT,
  p_issuer TEXT,
  p_serial_number TEXT,
  p_not_before TIMESTAMPTZ,
  p_not_after TIMESTAMPTZ,
  p_thumbprint TEXT,
  p_encrypted_pfx BYTEA,
  p_encryption_iv BYTEA,
  p_encryption_salt BYTEA,
  p_nickname TEXT DEFAULT NULL,
  p_is_default BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_tenant_id UUID;
  v_cert_id UUID;
  v_existing UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id, tenant_id INTO v_profile_id, v_tenant_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  -- Verificar se certificado já existe
  SELECT id INTO v_existing
  FROM public.profile_certificates
  WHERE profile_id = v_profile_id AND thumbprint = p_thumbprint;

  IF v_existing IS NOT NULL THEN
    -- Atualizar certificado existente
    UPDATE public.profile_certificates
    SET 
      encrypted_pfx = p_encrypted_pfx,
      encryption_iv = p_encryption_iv,
      encryption_salt = p_encryption_salt,
      nickname = COALESCE(p_nickname, nickname),
      is_default = p_is_default,
      is_active = true,
      updated_at = NOW()
    WHERE id = v_existing
    RETURNING id INTO v_cert_id;

    RETURN jsonb_build_object(
      'success', true,
      'certificate_id', v_cert_id,
      'message', 'Certificado atualizado com sucesso',
      'updated', true
    );
  END IF;

  -- Inserir novo certificado
  INSERT INTO public.profile_certificates (
    profile_id, tenant_id, certificate_type,
    common_name, cpf_cnpj, issuer, serial_number,
    not_before, not_after, thumbprint,
    encrypted_pfx, encryption_iv, encryption_salt,
    nickname, is_default
  ) VALUES (
    v_profile_id, v_tenant_id, 'A1',
    p_common_name, p_cpf_cnpj, p_issuer, p_serial_number,
    p_not_before, p_not_after, p_thumbprint,
    p_encrypted_pfx, p_encryption_iv, p_encryption_salt,
    p_nickname, p_is_default
  )
  RETURNING id INTO v_cert_id;

  RETURN jsonb_build_object(
    'success', true,
    'certificate_id', v_cert_id,
    'message', 'Certificado cadastrado com sucesso',
    'updated', false
  );
END;
$$;

COMMENT ON FUNCTION public.register_certificate_a1 IS 'Registra um certificado A1 criptografado no perfil do profissional';

-- ============================================================
-- 6. RPC: Listar Certificados do Profissional
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_my_certificates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_certs JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'certificate_type', c.certificate_type,
      'common_name', c.common_name,
      'cpf_cnpj', c.cpf_cnpj,
      'issuer', c.issuer,
      'serial_number', c.serial_number,
      'not_before', c.not_before,
      'not_after', c.not_after,
      'thumbprint', c.thumbprint,
      'is_active', c.is_active,
      'is_default', c.is_default,
      'nickname', c.nickname,
      'created_at', c.created_at,
      'last_used_at', c.last_used_at,
      'days_until_expiry', EXTRACT(DAY FROM (c.not_after - NOW())),
      'is_expired', c.not_after < NOW(),
      'has_encrypted_pfx', c.encrypted_pfx IS NOT NULL
    ) ORDER BY c.is_default DESC, c.created_at DESC
  ), '[]'::jsonb) INTO v_certs
  FROM public.profile_certificates c
  WHERE c.profile_id = v_profile_id AND c.is_active = true;

  RETURN jsonb_build_object('success', true, 'certificates', v_certs);
END;
$$;

COMMENT ON FUNCTION public.list_my_certificates IS 'Lista certificados digitais do profissional logado';

-- ============================================================
-- 7. RPC: Obter Certificado Criptografado para Assinatura
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_certificate_for_signing(
  p_certificate_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_cert RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  -- Buscar certificado específico ou padrão
  IF p_certificate_id IS NOT NULL THEN
    SELECT * INTO v_cert
    FROM public.profile_certificates
    WHERE id = p_certificate_id 
      AND profile_id = v_profile_id 
      AND is_active = true;
  ELSE
    SELECT * INTO v_cert
    FROM public.profile_certificates
    WHERE profile_id = v_profile_id 
      AND is_active = true 
      AND is_default = true;

    IF NOT FOUND THEN
      SELECT * INTO v_cert
      FROM public.profile_certificates
      WHERE profile_id = v_profile_id 
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum certificado encontrado');
  END IF;

  IF v_cert.not_after < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificado expirado');
  END IF;

  -- Atualizar last_used_at
  UPDATE public.profile_certificates
  SET last_used_at = NOW()
  WHERE id = v_cert.id;

  RETURN jsonb_build_object(
    'success', true,
    'certificate', jsonb_build_object(
      'id', v_cert.id,
      'certificate_type', v_cert.certificate_type,
      'common_name', v_cert.common_name,
      'cpf_cnpj', v_cert.cpf_cnpj,
      'issuer', v_cert.issuer,
      'thumbprint', v_cert.thumbprint,
      'encrypted_pfx', encode(v_cert.encrypted_pfx, 'base64'),
      'encryption_iv', encode(v_cert.encryption_iv, 'base64'),
      'encryption_salt', encode(v_cert.encryption_salt, 'base64')
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_certificate_for_signing IS 'Obtém certificado criptografado para assinatura (requer senha do usuário para descriptografar)';

-- ============================================================
-- 8. RPC: Definir Certificado Padrão
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_default_certificate(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_cert_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.profile_certificates
    WHERE id = p_certificate_id AND profile_id = v_profile_id AND is_active = true
  ) INTO v_cert_exists;

  IF NOT v_cert_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificado não encontrado');
  END IF;

  UPDATE public.profile_certificates
  SET is_default = true
  WHERE id = p_certificate_id;

  RETURN jsonb_build_object('success', true, 'message', 'Certificado definido como padrão');
END;
$$;

-- ============================================================
-- 9. RPC: Remover Certificado
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_certificate(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  UPDATE public.profile_certificates
  SET is_active = false, updated_at = NOW()
  WHERE id = p_certificate_id AND profile_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificado não encontrado');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Certificado removido');
END;
$$;

-- ============================================================
-- 10. GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.register_certificate_a1 TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_certificates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_certificate_for_signing TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_certificate TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_certificate TO authenticated;
