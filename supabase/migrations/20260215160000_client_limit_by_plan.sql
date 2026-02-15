CREATE OR REPLACE FUNCTION public.tenant_within_client_limit(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tier AS (
    SELECT CASE
      WHEN s.plan IS NULL THEN 'basic'
      WHEN lower(s.plan) IN ('monthly','quarterly','annual') THEN 'basic'
      WHEN split_part(lower(s.plan), '_', 1) IN ('basic','pro','premium') THEN split_part(lower(s.plan), '_', 1)
      ELSE 'basic'
    END AS tier
    FROM public.subscriptions s
    WHERE s.tenant_id = p_tenant_id
    LIMIT 1
  ), lim AS (
    SELECT CASE
      WHEN (SELECT tier FROM tier) = 'basic' THEN 300
      WHEN (SELECT tier FROM tier) = 'pro' THEN 2000
      WHEN (SELECT tier FROM tier) = 'premium' THEN NULL
      ELSE 300
    END AS max_clients
  )
  SELECT
    (SELECT max_clients FROM lim) IS NULL
    OR (
      SELECT count(*)
      FROM public.clients c
      WHERE c.tenant_id = p_tenant_id
    ) < (SELECT max_clients FROM lim);
$$;

DROP POLICY IF EXISTS "Users can create clients in their tenant" ON public.clients;
CREATE POLICY "Users can create clients in their tenant"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
  AND public.tenant_within_client_limit(tenant_id)
);
