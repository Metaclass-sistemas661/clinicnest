-- Fix tenant_has_access to follow policy 2 (access valid until current_period_end even if status becomes inactive)

CREATE OR REPLACE FUNCTION public.tenant_has_access(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.tenant_id = p_tenant_id
      AND (
        lower(s.status) = 'active'
        OR (lower(s.status) = 'trialing' AND s.trial_end IS NOT NULL AND now() <= s.trial_end)
        OR (s.current_period_end IS NOT NULL AND now() <= s.current_period_end)
      )
    LIMIT 1
  );
$$;
