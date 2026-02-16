-- P1: Reduce auth context roundtrips by returning profile + role + tenant in a single RPC

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('profile', NULL, 'role', NULL, 'tenant', NULL);
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

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'role', CASE WHEN v_role.id IS NULL THEN NULL ELSE to_jsonb(v_role) END,
    'tenant', CASE WHEN v_tenant.id IS NULL THEN NULL ELSE to_jsonb(v_tenant) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_context() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_context() TO service_role;
