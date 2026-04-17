CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancellation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_cancelled_at     timestamptz;

  v_service_id       uuid;

  v_professional_id  uuid;

  v_tenant_id        uuid;

  v_cancelled_period text;

  v_hour             int;

  v_entry            record;

  v_link             text;

BEGIN

  -- Only fire when status changes TO 'cancelled'

  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN

    RETURN NEW;

  END IF;



  v_cancelled_at    := NEW.scheduled_at;

  v_service_id      := NEW.service_id;

  v_professional_id := NEW.professional_id;

  v_tenant_id       := NEW.tenant_id;



  -- Determine period from the cancelled appointment time

  v_hour := EXTRACT(HOUR FROM v_cancelled_at AT TIME ZONE 'America/Sao_Paulo');

  IF v_hour < 12 THEN

    v_cancelled_period := 'manha';

  ELSIF v_hour < 18 THEN

    v_cancelled_period := 'tarde';

  ELSE

    v_cancelled_period := 'noite';

  END IF;



  -- Find up to 3 compatible waitlist entries, ordered by priority then creation date

  FOR v_entry IN

    SELECT w.id, w.patient_id

    FROM waitlist w

    WHERE w.tenant_id = v_tenant_id

      AND w.status = 'aguardando'

      AND (w.service_id IS NULL OR w.service_id = v_service_id)

      AND (w.professional_id IS NULL OR w.professional_id = v_professional_id)

      AND (

        w.preferred_periods IS NULL

        OR cardinality(w.preferred_periods) = 0

        OR v_cancelled_period = ANY(w.preferred_periods)

      )

    ORDER BY

      CASE w.priority

        WHEN 'urgente' THEN 1

        WHEN 'alta'    THEN 2

        ELSE 3

      END,

      w.created_at ASC

    LIMIT 3

  LOOP

    -- Update waitlist entry status

    UPDATE waitlist

    SET status = 'notificado',

        notified_at = NOW(),

        updated_at = NOW()

    WHERE id = v_entry.id;



    -- Insert a notification for the patient (will be picked up by notify-patient-events)

    INSERT INTO notifications (

      user_id,

      tenant_id,

      type,

      title,

      message,

      metadata

    )

    SELECT

      pp.user_id,

      v_tenant_id,

      'waitlist_slot_available',

      'Vaga dispon├¡vel!',

      'Uma vaga ficou dispon├¡vel para o servi├ºo que voc├¬ aguardava. Acesse o app para agendar.',

      jsonb_build_object(

        'waitlist_id', v_entry.id,

        'appointment_date', v_cancelled_at::text,

        'service_id', v_service_id,

        'professional_id', v_professional_id,

        'period', v_cancelled_period

      )

    FROM patient_profiles pp

    WHERE pp.patient_id = v_entry.patient_id

    LIMIT 1;



    -- Insert into automation dispatch queue for WhatsApp/email

    -- The automation-worker will pick this up on next cron run

    INSERT INTO waitlist_notifications (

      tenant_id,

      waitlist_id,

      patient_id,

      appointment_date,

      service_id,

      professional_id,

      period,

      status

    ) VALUES (

      v_tenant_id,

      v_entry.id,

      v_entry.patient_id,

      v_cancelled_at,

      v_service_id,

      v_professional_id,

      v_cancelled_period,

      'pending'

    );

  END LOOP;



  RETURN NEW;

END;

$function$;