CREATE OR REPLACE FUNCTION public.trg_auto_generate_consents_on_plan_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_template RECORD;

  v_patient_user_id UUID;

BEGIN

  -- S├│ dispara quando status muda para 'aprovado'

  IF NEW.status <> 'aprovado' THEN

    RETURN NEW;

  END IF;

  IF OLD IS NOT NULL AND OLD.status = 'aprovado' THEN

    RETURN NEW;

  END IF;



  -- Buscar o user_id do paciente via patient_profiles

  SELECT pp.user_id INTO v_patient_user_id

  FROM public.patient_profiles pp

  WHERE pp.client_id = NEW.patient_id

    AND pp.tenant_id = NEW.tenant_id

    AND pp.is_active = true

  LIMIT 1;



  -- Se paciente n├úo tem conta no portal, n├úo gera consents autom├íticos

  IF v_patient_user_id IS NULL THEN

    RETURN NEW;

  END IF;



  -- Para cada consent_template ativo e obrigat├│rio do tenant

  FOR v_template IN

    SELECT ct.id, ct.title, ct.body_html, ct.tenant_id

    FROM public.consent_templates ct

    WHERE ct.tenant_id = NEW.tenant_id

      AND ct.is_active = true

      AND ct.is_required = true

      AND NOT EXISTS (

        SELECT 1 FROM public.patient_consents pc

        WHERE pc.patient_id = NEW.patient_id

          AND pc.template_id = ct.id

      )

  LOOP

    INSERT INTO public.patient_consents (

      tenant_id,

      patient_id,

      template_id,

      patient_user_id,

      template_snapshot_html,

      signed_at

    )

    VALUES (

      v_template.tenant_id,

      NEW.patient_id,

      v_template.id,

      v_patient_user_id,

      v_template.body_html,

      NOW()

    )

    ON CONFLICT (patient_id, template_id) DO NOTHING;

  END LOOP;



  RETURN NEW;

END;

$function$;