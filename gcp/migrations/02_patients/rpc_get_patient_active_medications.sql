CREATE OR REPLACE FUNCTION public.get_patient_active_medications()
 RETURNS TABLE(id uuid, medication_name text, dosage text, prescription_date timestamp with time zone, expiry_date date, professional_name text, is_expired boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_tenant_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true

  LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  RETURN QUERY

  SELECT

    pr.id,

    LEFT(COALESCE(pr.medications, 'Medicamento'), 150)             AS medication_name,

    ''::text                                                        AS dosage,

    pr.issued_at                                                    AS prescription_date,

    COALESCE(

      pr.expires_at::date,

      (pr.issued_at + (COALESCE(pr.validity_days, 30) * INTERVAL '1 day'))::date

    )                                                               AS expiry_date,

    COALESCE(prof.full_name, '')                                    AS professional_name,

    COALESCE(

      pr.expires_at::date,

      (pr.issued_at + (COALESCE(pr.validity_days, 30) * INTERVAL '1 day'))::date

    ) < CURRENT_DATE                                                AS is_expired

  FROM public.prescriptions pr

  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id

  WHERE pr.patient_id = v_client_id

    AND pr.tenant_id  = v_tenant_id

    AND pr.issued_at  > now() - INTERVAL '180 days'

  ORDER BY pr.issued_at DESC;

END;

$function$;