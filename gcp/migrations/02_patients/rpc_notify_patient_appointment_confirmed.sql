CREATE OR REPLACE FUNCTION public.notify_patient_appointment_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_patient_user_id UUID;

  v_prof_name TEXT;

  v_clinic_name TEXT;

  v_procedure_name TEXT;

  v_scheduled TEXT;

BEGIN

  -- S├│ dispara quando status muda para 'confirmed' a partir de 'pending'

  IF NEW.status != 'confirmed' OR OLD.status != 'pending' THEN

    RETURN NEW;

  END IF;



  -- Buscar user_id do paciente via patient_profiles

  SELECT pp.user_id INTO v_patient_user_id

  FROM public.patient_profiles pp

  WHERE pp.client_id = NEW.patient_id

    AND pp.tenant_id = NEW.tenant_id

    AND pp.is_active = true

  LIMIT 1;



  -- Se o paciente n├úo tem conta no portal, n├úo faz nada

  IF v_patient_user_id IS NULL THEN

    RETURN NEW;

  END IF;



  -- Buscar dados para a notifica├º├úo

  SELECT COALESCE(p.full_name, 'Profissional') INTO v_prof_name

  FROM public.profiles p

  WHERE p.id = NEW.professional_id;



  SELECT COALESCE(t.name, 'Cl├¡nica') INTO v_clinic_name

  FROM public.tenants t

  WHERE t.id = NEW.tenant_id;



  SELECT COALESCE(proc.name, 'Consulta') INTO v_procedure_name

  FROM public.procedures proc

  WHERE proc.id = NEW.procedure_id;



  v_scheduled := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "├ás" HH24:MI');



  -- Inserir notifica├º├úo no portal do paciente

  INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)

  VALUES (

    v_patient_user_id,

    'appointment_confirmed',

    'Agendamento confirmado! Ô£à',

    format('Seu agendamento de %s com %s em %s foi confirmado pela cl├¡nica %s.',

      v_procedure_name, v_prof_name, v_scheduled, v_clinic_name

    ),

    jsonb_build_object(

      'appointment_id', NEW.id,

      'procedure_name', v_procedure_name,

      'professional_name', v_prof_name,

      'clinic_name', v_clinic_name,

      'scheduled_at', NEW.scheduled_at

    )

  );



  RAISE LOG 'notify_patient_appointment_confirmed: patient_user=% appointment=%', v_patient_user_id, NEW.id;

  RETURN NEW;

END;

$function$;