CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- During free trial (5 days), everything is enabled.
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.tenant_id = p_tenant_id
        AND lower(s.status) = 'trialing'
        AND s.trial_end IS NOT NULL
        AND now() <= s.trial_end
      LIMIT 1
    ) THEN true
    WHEN public.tenant_plan_tier(p_tenant_id) = 'premium' THEN true
    WHEN public.tenant_plan_tier(p_tenant_id) = 'pro' THEN
      lower(coalesce(p_feature, '')) IN (
        'pdf_export',
        'data_export',
        'advanced_reports'
      )
    ELSE
      false
  END;
$$;
