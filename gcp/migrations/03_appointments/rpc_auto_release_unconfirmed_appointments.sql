CREATE OR REPLACE FUNCTION public.auto_release_unconfirmed_appointments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_count integer := 0;

  v_appt  record;

BEGIN

  FOR v_appt IN

    SELECT a.id, a.tenant_id, a.service_id, a.professional_id, a.scheduled_at, a.patient_id

    FROM appointments a

    JOIN tenants t ON t.id = a.tenant_id

    WHERE t.smart_confirmation_enabled = true

      AND a.status IN ('pending')

      AND a.confirmed_at IS NULL

      AND a.confirmation_sent_4h = true

      AND a.confirmation_sent_1h = true

      AND a.scheduled_at <= NOW() + (t.smart_confirmation_autorelease_minutes || ' minutes')::interval

      AND a.scheduled_at > NOW()

      AND a.confirmation_auto_released = false

  LOOP

    -- Cancela o agendamento

    UPDATE appointments

    SET status = 'cancelled',

        confirmation_auto_released = true,

        notes = COALESCE(notes, '') || E'\n[Auto-liberado: paciente n├úo confirmou presen├ºa]',

        updated_at = NOW()

    WHERE id = v_appt.id;



    -- Notifica internamente

    INSERT INTO notifications (user_id, tenant_id, type, title, message, data)

    SELECT

      p.user_id,

      v_appt.tenant_id,

      'appointment_auto_released',

      'Vaga auto-liberada',

      'Paciente n├úo confirmou e a vaga foi liberada automaticamente.',

      jsonb_build_object('appointment_id', v_appt.id, 'scheduled_at', v_appt.scheduled_at::text)

    FROM profiles p

    WHERE p.id = v_appt.professional_id AND p.user_id IS NOT NULL;



    v_count := v_count + 1;

  END LOOP;



  RETURN jsonb_build_object('released', v_count);

END;

$function$;