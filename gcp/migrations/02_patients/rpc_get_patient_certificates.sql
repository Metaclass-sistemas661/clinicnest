CREATE OR REPLACE FUNCTION public.get_patient_certificates(p_tenant_id uuid DEFAULT NULL::uuid)
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

        'id', mc.id,

        'tenant_id', mc.tenant_id,

        'certificate_type', mc.certificate_type,

        'issued_at', mc.issued_at,

        'days_off', mc.days_off,

        'start_date', mc.start_date,

        'end_date', mc.end_date,

        'cid_code', mc.cid_code,

        'content', mc.content,

        'notes', mc.notes,

        'professional_name', COALESCE(pr.full_name, ''),

        'clinic_name', COALESCE(t.name, '')

      )

      FROM public.medical_certificates mc

      LEFT JOIN public.profiles pr ON pr.id = mc.professional_id

      LEFT JOIN public.tenants t ON t.id = mc.tenant_id

      WHERE mc.patient_id = v_link.client_id

        AND mc.tenant_id = v_link.tenant_id

      ORDER BY mc.issued_at DESC;

  END LOOP;

END;

$function$;