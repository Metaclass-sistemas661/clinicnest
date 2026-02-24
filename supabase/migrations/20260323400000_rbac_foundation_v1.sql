-- FASE 12A — Fundação do RBAC (Controle de Acessos Granular)
-- Itens: 12A.1, 12A.2, 12A.3, 12A.4, 12A.5, 12A.6

-- ============================================================
-- 12A.1 — Enum professional_type
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.professional_type AS ENUM (
      'admin',
      'medico',
      'dentista',
      'enfermeiro',
      'tec_enfermagem',
      'fisioterapeuta',
      'nutricionista',
      'psicologo',
      'fonoaudiologo',
      'secretaria',
      'faturista',
      'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 12A.2 — Colunas em profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_type public.professional_type NOT NULL DEFAULT 'secretaria',
  ADD COLUMN IF NOT EXISTS council_type TEXT,
  ADD COLUMN IF NOT EXISTS council_number TEXT,
  ADD COLUMN IF NOT EXISTS council_state TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_professional_type
  ON public.profiles (tenant_id, professional_type);

-- ============================================================
-- 12A.3 — Tabela role_templates (permissões padrão por tipo)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  professional_type public.professional_type NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, professional_type)
);

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role templates in their tenant"
  ON public.role_templates FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage role templates"
  ON public.role_templates FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_role_templates_updated_at
  BEFORE UPDATE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 12A.4 — Tabela permission_overrides (override por usuário)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resource TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, resource)
);

ALTER TABLE public.permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permission overrides"
  ON public.permission_overrides FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (user_id = auth.uid() OR public.is_tenant_admin(auth.uid(), tenant_id))
  );

CREATE POLICY "Admins can manage permission overrides"
  ON public.permission_overrides FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_permission_overrides_user
  ON public.permission_overrides (tenant_id, user_id);

-- ============================================================
-- Seed: default role_templates para cada tenant existente
-- (e trigger para criar automaticamente em novos tenants)
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_role_templates_for_tenant(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_templates JSONB := '[
    {
      "type": "admin",
      "name": "Administrador",
      "perms": {
        "dashboard":"vcud","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"v","laudos":"v","atestados":"v",
        "encaminhamentos":"v","triagem":"v","evolucao_enfermagem":"v","evolucao_clinica":"v",
        "odontograma":"v","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"vcud",
        "chat":"vcud","financeiro":"vcud","faturamento_tiss":"vcud","convenios":"vcud",
        "relatorios":"vcud","compras":"vcud","fornecedores":"vcud","produtos":"vcud",
        "campanhas":"vcud","automacoes":"vcud","equipe":"vcud","configuracoes":"vcud",
        "auditoria":"vcud","assinatura":"vcud","disponibilidade":"vcud",
        "especialidades":"vcud","modelos_prontuario":"vcud","termos_consentimento":"vcud",
        "contratos_termos":"vcud","integracoes":"vcud","api_docs":"vcud",
        "agendamento_online":"vcud","fidelidade_cashback":"vcud","vouchers":"vcud","cupons":"vcud"
      }
    },
    {
      "type": "medico",
      "name": "Médico(a)",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"vcud",
        "prontuarios":"vcud","receituarios":"vcud","laudos":"vcud","atestados":"vcud",
        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"v","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "dentista",
      "name": "Dentista",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"vcud",
        "prontuarios":"vcud","receituarios":"vcud","laudos":"vcud","atestados":"vcud",
        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"vcud","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "enfermeiro",
      "name": "Enfermeiro(a)",
      "perms": {
        "dashboard":"v","agenda":"vu","clientes":"vu","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"v","triagem":"vcud","evolucao_enfermagem":"vcud","evolucao_clinica":"v",
        "odontograma":"","teleconsulta":"","lista_espera":"v","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "tec_enfermagem",
      "name": "Técnico(a) de Enfermagem",
      "perms": {
        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"vcud","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"","lista_espera":"v","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "fisioterapeuta",
      "name": "Fisioterapeuta",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",
        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "nutricionista",
      "name": "Nutricionista",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "psicologo",
      "name": "Psicólogo(a)",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",
        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "fonoaudiologo",
      "name": "Fonoaudiólogo(a)",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",
        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",
        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",
        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"v",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"vcud",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "secretaria",
      "name": "Secretária / Recepcionista",
      "perms": {
        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"v","lista_espera":"vcud","gestao_salas":"v",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"vcud",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "faturista",
      "name": "Faturista",
      "perms": {
        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"","lista_espera":"","gestao_salas":"",
        "chat":"vcud","financeiro":"v","faturamento_tiss":"vcud","convenios":"v",
        "relatorios":"v","compras":"","fornecedores":"","produtos":"",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    },
    {
      "type": "custom",
      "name": "Perfil Customizado",
      "perms": {
        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",
        "prontuarios":"","receituarios":"","laudos":"","atestados":"",
        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",
        "odontograma":"","teleconsulta":"","lista_espera":"","gestao_salas":"",
        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",
        "relatorios":"","compras":"","fornecedores":"","produtos":"",
        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",
        "auditoria":"","assinatura":"","disponibilidade":"",
        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",
        "contratos_termos":"","integracoes":"","api_docs":"",
        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""
      }
    }
  ]'::jsonb;
  v_item JSONB;
  v_perms_expanded JSONB;
  v_resource TEXT;
  v_actions TEXT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_templates) LOOP
    v_perms_expanded := '{}'::jsonb;
    FOR v_resource, v_actions IN SELECT * FROM jsonb_each_text(v_item->'perms') LOOP
      v_perms_expanded := v_perms_expanded || jsonb_build_object(
        v_resource, jsonb_build_object(
          'view', v_actions LIKE '%v%',
          'create', v_actions LIKE '%c%',
          'edit', v_actions LIKE '%u%',
          'delete', v_actions LIKE '%d%'
        )
      );
    END LOOP;

    INSERT INTO public.role_templates (tenant_id, name, professional_type, permissions, is_system)
    VALUES (
      p_tenant_id,
      v_item->>'name',
      (v_item->>'type')::public.professional_type,
      v_perms_expanded,
      true
    )
    ON CONFLICT (tenant_id, professional_type) DO NOTHING;
  END LOOP;
END;
$$;

-- Seed templates for all existing tenants
DO $$
DECLARE
  v_tid UUID;
BEGIN
  FOR v_tid IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_role_templates_for_tenant(v_tid);
  END LOOP;
END;
$$;

-- Auto-seed templates when a new tenant is created
CREATE OR REPLACE FUNCTION public.on_tenant_created_seed_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_role_templates_for_tenant(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_seed_role_templates ON public.tenants;
CREATE TRIGGER trg_tenant_seed_role_templates
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.on_tenant_created_seed_templates();

-- ============================================================
-- 12A.5 — RPC get_effective_permissions
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_prof_type public.professional_type;
  v_is_admin BOOLEAN;
  v_base JSONB;
  v_overrides JSONB;
  v_resource TEXT;
  v_override JSONB;
BEGIN
  SELECT p.tenant_id, p.professional_type
  INTO v_tenant_id, v_prof_type
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  v_is_admin := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.tenant_id = v_tenant_id AND ur.role = 'admin'
  );

  IF v_is_admin THEN
    SELECT permissions INTO v_base
    FROM public.role_templates
    WHERE tenant_id = v_tenant_id AND professional_type = 'admin'
    LIMIT 1;
  ELSE
    SELECT permissions INTO v_base
    FROM public.role_templates
    WHERE tenant_id = v_tenant_id AND professional_type = v_prof_type
    LIMIT 1;
  END IF;

  v_base := COALESCE(v_base, '{}'::jsonb);

  FOR v_resource, v_override IN
    SELECT po.resource, jsonb_build_object(
      'view', po.can_view,
      'create', po.can_create,
      'edit', po.can_edit,
      'delete', po.can_delete
    )
    FROM public.permission_overrides po
    WHERE po.tenant_id = v_tenant_id AND po.user_id = p_user_id
  LOOP
    v_base := v_base || jsonb_build_object(v_resource, v_override);
  END LOOP;

  RETURN v_base;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_permissions(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(UUID) TO service_role;

-- ============================================================
-- 12A.6 — Expandir get_my_context com professional_type e permissions
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_role public.user_roles%rowtype;
  v_tenant public.tenants%rowtype;
  v_permissions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('profile', NULL, 'role', NULL, 'tenant', NULL, 'permissions', '{}'::jsonb);
  END IF;

  SELECT * INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
    AND ur.tenant_id = v_profile.tenant_id
  LIMIT 1;

  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_profile.tenant_id
  LIMIT 1;

  v_permissions := public.get_effective_permissions(v_user_id);

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'role', CASE WHEN v_role.id IS NULL THEN NULL ELSE to_jsonb(v_role) END,
    'tenant', CASE WHEN v_tenant.id IS NULL THEN NULL ELSE to_jsonb(v_tenant) END,
    'permissions', v_permissions
  );
END;
$$;

-- ============================================================
-- Helper: is_clinical_professional (para uso futuro em RLS — Fase 12C)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_clinical_professional(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND professional_type IN (
        'medico','dentista','enfermeiro','fisioterapeuta',
        'nutricionista','psicologo','fonoaudiologo'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_prescriber(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND professional_type IN ('medico','dentista')
  );
$$;

REVOKE ALL ON FUNCTION public.is_clinical_professional(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_clinical_professional(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinical_professional(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.is_prescriber(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_prescriber(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_prescriber(UUID) TO service_role;
