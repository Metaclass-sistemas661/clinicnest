CREATE OR REPLACE FUNCTION public.log_odontogram_tooth_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF TG_OP = 'UPDATE' AND (

    OLD.condition IS DISTINCT FROM NEW.condition OR

    OLD.surfaces IS DISTINCT FROM NEW.surfaces OR

    OLD.notes IS DISTINCT FROM NEW.notes

  ) THEN

    INSERT INTO public.odontogram_tooth_history (

      odontogram_id, tooth_number,

      previous_condition, new_condition,

      previous_surfaces, new_surfaces,

      previous_notes, new_notes,

      changed_by

    ) VALUES (

      NEW.odontogram_id, NEW.tooth_number,

      OLD.condition, NEW.condition,

      OLD.surfaces, NEW.surfaces,

      OLD.notes, NEW.notes,

      current_setting('app.current_user_id')::uuid

    );

  END IF;

  RETURN NEW;

END;

$function$;