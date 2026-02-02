-- Fix the INSERT policy to be more restrictive
DROP POLICY IF EXISTS "Allow authenticated users to insert subscriptions" ON public.subscriptions;

-- Only allow inserting subscription for user's own tenant
CREATE POLICY "Users can create subscription for their tenant"
ON public.subscriptions
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
);