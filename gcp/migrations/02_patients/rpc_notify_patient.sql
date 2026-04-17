CREATE OR REPLACE FUNCTION public.notify_patient()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_patient record;

  v_type text;

  v_title text;

  v_body text;

  v_prof_name text;

  v_clinic_name text;

  v_metadata jsonb;

BEGIN

  -- Buscar todos os pacientes vinculados a este patient_id + tenant_id

  -- NOTA: patient_profiles.client_id continua com esse nome (bridge table)

  FOR v_patient IN

    SELECT pp.user_id

    FROM public.patient_profiles pp

    WHERE pp.client_id = NEW.patient_id

      AND pp.tenant_id = NEW.tenant_id

      AND pp.is_active = true

  LOOP

    v_prof_name := '';

    IF TG_TABLE_NAME = 'exam_results' THEN

      SELECT COALESCE(p.full_name, '') INTO v_prof_name

      FROM public.profiles p WHERE p.id = NEW.requested_by;

    ELSE

      SELECT COALESCE(p.full_name, '') INTO v_prof_name

      FROM public.profiles p WHERE p.id = NEW.professional_id;

    END IF;



    SELECT COALESCE(t.name, '') INTO v_clinic_name

    FROM public.tenants t WHERE t.id = NEW.tenant_id;



    IF TG_TABLE_NAME = 'medical_certificates' THEN

      v_type := 'certificate_released';

      v_title := 'Novo atestado dispon├¡vel';

      v_body := format('O Dr(a). %s emitiu um %s para voc├¬.',

        v_prof_name,

        CASE NEW.certificate_type

          WHEN 'atestado' THEN 'atestado m├®dico'

          WHEN 'declaracao_comparecimento' THEN 'declara├º├úo de comparecimento'

          WHEN 'laudo' THEN 'laudo m├®dico'

          WHEN 'relatorio' THEN 'relat├│rio m├®dico'

          ELSE 'documento m├®dico'

        END

      );

      v_metadata := jsonb_build_object(

        'certificate_id', NEW.id,

        'certificate_type', NEW.certificate_type,

        'professional_name', v_prof_name,

        'clinic_name', v_clinic_name

      );



    ELSIF TG_TABLE_NAME = 'prescriptions' THEN

      v_type := 'prescription_released';

      v_title := 'Nova receita dispon├¡vel';

      v_body := format('O Dr(a). %s emitiu uma receita %s para voc├¬.',

        v_prof_name,

        CASE NEW.prescription_type

          WHEN 'simples' THEN 'simples'

          WHEN 'especial_b' THEN 'especial B'

          WHEN 'especial_a' THEN 'especial A'

          WHEN 'antimicrobiano' THEN 'de antimicrobiano'

          ELSE ''

        END

      );

      v_metadata := jsonb_build_object(

        'prescription_id', NEW.id,

        'prescription_type', NEW.prescription_type,

        'professional_name', v_prof_name,

        'clinic_name', v_clinic_name

      );



    ELSIF TG_TABLE_NAME = 'exam_results' THEN

      v_type := 'exam_released';

      v_title := 'Novo resultado de exame dispon├¡vel';

      v_body := format('O resultado do exame "%s" j├í est├í dispon├¡vel.', COALESCE(NEW.exam_name, 'Exame'));

      v_metadata := jsonb_build_object(

        'exam_id', NEW.id,

        'exam_name', NEW.exam_name,

        'professional_name', v_prof_name,

        'clinic_name', v_clinic_name

      );

    END IF;



    INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)

    VALUES (v_patient.user_id, v_type, v_title, v_body, v_metadata);

  END LOOP;



  RETURN NEW;

END;

$function$;