CREATE OR REPLACE FUNCTION public.tenant_appointment_history_cutoff(p_tenant_id uuid)
RETURNS timestamptz
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
  )
  SELECT CASE
    WHEN (SELECT tier FROM tier) = 'basic' THEN now() - interval '6 months'
    WHEN (SELECT tier FROM tier) = 'pro' THEN now() - interval '24 months'
    WHEN (SELECT tier FROM tier) = 'premium' THEN NULL
    ELSE now() - interval '6 months'
  END;
$$;

DROP POLICY IF EXISTS "Users can view appointments in their tenant" ON public.appointments;
CREATE POLICY "Users can view appointments in their tenant"
ON public.appointments FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.tenant_appointment_history_cutoff(tenant_id) IS NULL
    OR scheduled_at >= public.tenant_appointment_history_cutoff(tenant_id)
  )
);
