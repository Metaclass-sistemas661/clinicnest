-- Allow authenticated users to create tenants (for new signups)
CREATE POLICY "Users can create tenants during signup"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow new users to create their own profile
DROP POLICY IF EXISTS "Admins can insert profiles in their tenant" ON public.profiles;

CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow new users to create their own role
CREATE POLICY "Users can create their own role during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());