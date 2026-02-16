-- Phase 2: RLS hardening (multi-tenant safety)

-- tenants: restrict INSERT to signup trigger context or authenticated users without profile yet
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can create tenants during signup" ON public.tenants;
  DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
  DROP POLICY IF EXISTS "Allow authenticated users to insert tenants" ON public.tenants;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "Allow signup tenant insert"
  ON public.tenants FOR INSERT
  WITH CHECK (
    (
      -- Trigger (SECURITY DEFINER) paths often run without JWT claims.
      -- Restrict this "no auth.uid" path to trusted database roles.
      auth.uid() IS NULL
      AND current_user IN ('postgres', 'supabase_auth_admin', 'supabase_admin')
    )
    OR (
      auth.role() = 'authenticated'
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
      )
    )
  );

-- subscriptions: restrict INSERT to trigger context (auth.uid() is null) or service_role
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to insert subscriptions" ON public.subscriptions;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    (
      auth.uid() IS NULL
      AND current_user IN ('postgres', 'supabase_auth_admin', 'supabase_admin', 'service_role')
    )
    OR (
      auth.role() = 'authenticated'
      AND tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- appointment_completion_summaries: never allow open insert
DO $$
BEGIN
  DROP POLICY IF EXISTS "Sistema pode inserir completion summaries" ON public.appointment_completion_summaries;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "System can insert completion summaries"
  ON public.appointment_completion_summaries FOR INSERT
  WITH CHECK (public.tenant_has_access(tenant_id));
