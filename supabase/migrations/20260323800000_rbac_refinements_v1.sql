-- FASE 12G — Refinamentos RBAC & Multi-sede

-- ============================================================
-- 12G.3 — Permissões por unidade (multi-sede)
-- ============================================================

ALTER TABLE public.permission_overrides
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.clinic_units(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_permission_overrides_unit
  ON public.permission_overrides (tenant_id, user_id, unit_id);

COMMENT ON COLUMN public.permission_overrides.unit_id IS 
  'Quando preenchido, o override se aplica apenas a esta unidade. NULL = todas as unidades.';

-- ============================================================
-- 12G.4 — Modo somente leitura emergencial
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_readonly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS readonly_reason TEXT,
  ADD COLUMN IF NOT EXISTS readonly_since TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.is_readonly IS 
  'Quando true, o profissional só pode visualizar dados (sem criar/editar/excluir). Usado em investigações internas.';

-- Atualizar get_effective_permissions para respeitar is_readonly
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
  v_is_readonly BOOLEAN;
  v_base JSONB;
  v_resource TEXT;
  v_override JSONB;
  v_perm JSONB;
BEGIN
  SELECT p.tenant_id, p.professional_type, p.is_readonly
  INTO v_tenant_id, v_prof_type, v_is_readonly
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

  -- Apply overrides (global, unit_id IS NULL)
  FOR v_resource, v_override IN
    SELECT po.resource, jsonb_build_object(
      'view', po.can_view,
      'create', po.can_create,
      'edit', po.can_edit,
      'delete', po.can_delete
    )
    FROM public.permission_overrides po
    WHERE po.tenant_id = v_tenant_id AND po.user_id = p_user_id AND po.unit_id IS NULL
  LOOP
    v_base := v_base || jsonb_build_object(v_resource, v_override);
  END LOOP;

  -- If readonly mode, strip create/edit/delete from all resources
  IF v_is_readonly AND NOT v_is_admin THEN
    FOR v_resource IN SELECT jsonb_object_keys(v_base) LOOP
      v_perm := v_base->v_resource;
      v_base := v_base || jsonb_build_object(
        v_resource, jsonb_build_object(
          'view', COALESCE((v_perm->>'view')::boolean, false),
          'create', false,
          'edit', false,
          'delete', false
        )
      );
    END LOOP;
  END IF;

  RETURN v_base;
END;
$$;

-- ============================================================
-- 12G.2 — RPC para clonar permissões entre usuários
-- ============================================================

CREATE OR REPLACE FUNCTION public.clone_permission_overrides(
  p_source_user_id UUID,
  p_target_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INT := 0;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem tenant';
  END IF;

  IF NOT public.is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem clonar permissões';
  END IF;

  -- Verify both users belong to same tenant
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_source_user_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Usuário de origem não pertence ao tenant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Usuário de destino não pertence ao tenant';
  END IF;

  -- Delete existing overrides for target
  DELETE FROM public.permission_overrides
  WHERE tenant_id = v_tenant_id AND user_id = p_target_user_id;

  -- Copy from source to target
  INSERT INTO public.permission_overrides (tenant_id, user_id, resource, can_view, can_create, can_edit, can_delete, unit_id)
  SELECT v_tenant_id, p_target_user_id, resource, can_view, can_create, can_edit, can_delete, unit_id
  FROM public.permission_overrides
  WHERE tenant_id = v_tenant_id AND user_id = p_source_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clone_permission_overrides(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_permission_overrides(UUID, UUID) TO authenticated;

-- ============================================================
-- 12G.1 — RPC para atualizar role_templates em batch
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_role_template_permissions(
  p_professional_type public.professional_type,
  p_permissions JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem tenant';
  END IF;

  IF NOT public.is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar templates de permissão';
  END IF;

  UPDATE public.role_templates
  SET permissions = p_permissions, updated_at = now()
  WHERE tenant_id = v_tenant_id AND professional_type = p_professional_type;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.update_role_template_permissions(public.professional_type, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_role_template_permissions(public.professional_type, JSONB) TO authenticated;

-- ============================================================
-- 12G.4 — RPC para ativar/desativar modo readonly
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_user_readonly(
  p_target_user_id UUID,
  p_readonly BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem tenant';
  END IF;

  IF NOT public.is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar modo somente leitura';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Usuário não pertence ao tenant';
  END IF;

  UPDATE public.profiles
  SET 
    is_readonly = p_readonly,
    readonly_reason = CASE WHEN p_readonly THEN p_reason ELSE NULL END,
    readonly_since = CASE WHEN p_readonly THEN now() ELSE NULL END
  WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_readonly(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_readonly(UUID, BOOLEAN, TEXT) TO authenticated;
