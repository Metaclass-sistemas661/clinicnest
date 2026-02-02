-- Drop the old permissive policy
DROP POLICY IF EXISTS "Allow authenticated users to insert tenants" ON public.tenants;

-- Create a more secure policy that still allows signup but only for authenticated users
CREATE POLICY "Authenticated users can create tenants during signup"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow if user doesn't have a profile yet (signup flow)
  NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid()
  )
);