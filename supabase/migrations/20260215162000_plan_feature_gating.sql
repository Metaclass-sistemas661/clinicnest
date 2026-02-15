CREATE OR REPLACE FUNCTION public.tenant_plan_tier(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.plan IS NULL THEN 'basic'
    WHEN lower(s.plan) IN ('monthly','quarterly','annual') THEN 'basic'
    WHEN split_part(lower(s.plan), '_', 1) IN ('basic','pro','premium') THEN split_part(lower(s.plan), '_', 1)
    ELSE 'basic'
  END
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tier AS (
    SELECT public.tenant_plan_tier(p_tenant_id) AS tier
  )
  SELECT CASE
    WHEN (SELECT tier FROM tier) = 'premium' THEN true
    WHEN (SELECT tier FROM tier) = 'pro' THEN
      lower(coalesce(p_feature, '')) IN (
        'pdf_export',
        'data_export',
        'advanced_reports'
      )
    ELSE
      false
  END;
$$;
