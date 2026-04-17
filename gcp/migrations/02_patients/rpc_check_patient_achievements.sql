CREATE OR REPLACE FUNCTION public.check_patient_achievements()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE v_user_id uuid; v_client_id uuid; v_tenant_id uuid; v_new text[]:='{}'; v_appt int; v_rat int;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN RETURN jsonb_build_object('new_achievements',v_new); END IF;

  SELECT pp.client_id,pp.tenant_id INTO v_client_id,v_tenant_id FROM public.patient_profiles pp WHERE pp.user_id=v_user_id AND pp.is_active=true LIMIT 1;

  IF v_client_id IS NULL THEN RETURN jsonb_build_object('new_achievements',v_new); END IF;



  SELECT COUNT(*) INTO v_appt FROM public.appointments WHERE patient_id=v_client_id AND status='completed';

  IF v_appt>=1 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'first_appointment','Primeira Consulta') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Primeira Consulta'); END IF; END IF;

  IF v_appt>=5 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'five_appointments','Paciente Frequente') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Paciente Frequente'); END IF; END IF;

  IF v_appt>=10 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'ten_appointments','Paciente Fiel') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Paciente Fiel'); END IF; END IF;

  SELECT COUNT(*) INTO v_rat FROM public.appointment_ratings WHERE patient_user_id=v_user_id;

  IF v_rat>=1 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'first_rating','Avaliador') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Avaliador'); END IF; END IF;

  RETURN jsonb_build_object('new_achievements',v_new);

END;

$function$;