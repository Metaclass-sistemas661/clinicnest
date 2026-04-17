CREATE OR REPLACE FUNCTION public.get_patient_prescriptions(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_uid uuid := current_setting('app.current_user_id')::uuid;

  v_link record;

BEGIN

  FOR v_link IN

    SELECT pp.tenant_id, pp.client_id

    FROM public.patient_profiles pp

    WHERE pp.user_id = v_uid

      AND pp.is_active = true

      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)

  LOOP

    RETURN QUERY

      SELECT jsonb_build_object(

        'id', p.id,

        'tenant_id', p.tenant_id,

        'prescription_type', p.prescription_type,

        'issued_at', p.issued_at,

        'validity_days', p.validity_days,

        'expires_at', p.expires_at,

        'medications', p.medications,

        'instructions', p.instructions,

        'status', p.status,

        'professional_name', COALESCE(pr.full_name, ''),

        'clinic_name', COALESCE(t.name, '')

      )

      FROM public.prescriptions p

      LEFT JOIN public.profiles pr ON pr.id = p.professional_id

      LEFT JOIN public.tenants t ON t.id = p.tenant_id

      WHERE p.patient_id = v_link.client_id

        AND p.tenant_id = v_link.tenant_id

      ORDER BY p.issued_at DESC;

  END LOOP;

END;

$function$;