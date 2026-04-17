CREATE OR REPLACE FUNCTION public.log_clinical_access(p_resource text, p_resource_id text DEFAULT NULL::text, p_patient_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_tenant_id uuid;

  v_log_id uuid;

  v_is_flagged boolean := false;

  v_professional_type text;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN NULL;

  END IF;



  SELECT p.tenant_id, p.professional_type::text

    INTO v_tenant_id, v_professional_type

    FROM public.profiles p

   WHERE p.user_id = v_user_id

   LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RETURN NULL;

  END IF;



  -- 12F.4: Flag acesso incomum ÔÇö paciente sem agendamento recente deste profissional

  IF p_patient_id IS NOT NULL AND p_resource IN ('medical_records', 'clinical_evolutions', 'prescriptions', 'medical_certificates') THEN

    IF NOT EXISTS (

      SELECT 1

        FROM public.appointments a

       WHERE a.tenant_id = v_tenant_id

         AND a.professional_id = (SELECT id FROM public.profiles WHERE user_id = v_user_id AND tenant_id = v_tenant_id LIMIT 1)

         AND a.client_id = p_patient_id::uuid

         AND a.appointment_date >= (now() - interval '30 days')::date

       LIMIT 1

    ) THEN

      v_is_flagged := true;

    END IF;

  END IF;



  INSERT INTO public.audit_logs (

    tenant_id, actor_user_id, action, entity_type, entity_id, metadata

  ) VALUES (

    v_tenant_id,

    v_user_id,

    'clinical_access',

    p_resource,

    p_resource_id,

    jsonb_build_object(

      'patient_id', p_patient_id,

      'professional_type', v_professional_type,

      'is_flagged', v_is_flagged,

      'access_type', 'view'

    ) || COALESCE(p_metadata, '{}'::jsonb)

  )

  RETURNING id INTO v_log_id;



  RETURN v_log_id;

END;

$function$;