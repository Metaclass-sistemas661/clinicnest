-- ============================================================================
-- MIGRAÇÃO: Corrige referências obsoletas após rename clients→patients / services→procedures
-- Arquivo: 20260703000000_fix_patient_portal_renames_v1.sql
--
-- Problemas corrigidos:
--   1) get_patient_appointments: usava a.client_id, a.service_id, public.clients, public.services
--   2) get_user_tenant_id: só olhava profiles (staff), pacientes recebiam NULL
--   3) user_has_tenant_access: mesma limitação que get_user_tenant_id
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Recria get_patient_appointments com colunas corretas
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_patient_appointments(timestamptz, timestamptz, text);

CREATE OR REPLACE FUNCTION public.get_patient_appointments(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      a.id,
      a.tenant_id,
      a.scheduled_at,
      a.duration_minutes,
      a.status,
      a.notes,
      a.telemedicine,
      a.procedure_id,
      a.professional_id,
      c.name AS client_name,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name
    FROM public.appointments a
    JOIN public.patient_profiles pp
      ON pp.tenant_id = a.tenant_id
     AND pp.client_id = a.patient_id
    LEFT JOIN public.patients c ON c.id = a.patient_id
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE pp.user_id = v_user_id
      AND pp.is_active = true
      AND (p_from IS NULL OR a.scheduled_at >= p_from)
      AND (p_to IS NULL OR a.scheduled_at <= p_to)
      AND (p_status IS NULL OR a.status = p_status::public.appointment_status)
    ORDER BY a.scheduled_at DESC
    LIMIT 200
  ) r;

  RETURN v_result;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Atualiza get_user_tenant_id para incluir patient_profiles como fallback
--    Assim pacientes também resolvem seu tenant_id corretamente.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1),
    (SELECT tenant_id FROM public.patient_profiles WHERE user_id = p_user_id AND is_active = true LIMIT 1)
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Atualiza user_has_tenant_access para incluir patient_profiles
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  )
  OR EXISTS (
    SELECT 1 FROM public.patient_profiles
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND is_active = true
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Garante que pacientes possam ler subscriptions da sua clínica
--    (necessário para useClinicSubscriptionStatus verificar trial/assinatura)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Verifica se a policy já existe antes de criar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions'
      AND policyname = 'Patients can read own clinic subscription'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Patients can read own clinic subscription"
      ON public.subscriptions
      FOR SELECT
      TO authenticated
      USING (
        tenant_id IN (
          SELECT pp.tenant_id
          FROM public.patient_profiles pp
          WHERE pp.user_id = auth.uid()
            AND pp.is_active = true
        )
      )
    $pol$;
  END IF;
END $$;
