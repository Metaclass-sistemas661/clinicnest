-- ============================================================================
-- Fix: Allow patient portal users to read their own data from 'patients' table
-- The existing RLS policy only works for staff (via get_user_tenant_id).
-- Patient portal users authenticate separately and need direct access to
-- their own row (resolved through patient_profiles).
-- ============================================================================

-- Patient can SELECT their own row in patients
CREATE POLICY "patients_select_own_via_patient_profile"
  ON public.patients FOR SELECT
  USING (
    id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- Patient can SELECT their own prescriptions (needed for health card medications)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prescriptions' AND policyname = 'prescriptions_select_own_patient'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "prescriptions_select_own_patient"
        ON public.prescriptions FOR SELECT
        USING (
          patient_id IN (
            SELECT pp.client_id FROM public.patient_profiles pp
            WHERE pp.user_id = auth.uid() AND pp.is_active = true
          )
        )
    $pol$;
  END IF;
END $$;

-- Patient can SELECT insurance_plans (public read for name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'insurance_plans' AND policyname = 'insurance_plans_select_patient'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "insurance_plans_select_patient"
        ON public.insurance_plans FOR SELECT
        USING (true)
    $pol$;
  END IF;
END $$;

-- Patient can SELECT tenants (public read for clinic name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenants' AND policyname = 'tenants_select_patient'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "tenants_select_patient"
        ON public.tenants FOR SELECT
        USING (true)
    $pol$;
  END IF;
END $$;
