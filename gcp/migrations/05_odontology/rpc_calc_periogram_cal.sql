CREATE OR REPLACE FUNCTION public.calc_periogram_cal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  IF NEW.probing_depth IS NOT NULL AND NEW.recession IS NOT NULL THEN

    NEW.clinical_attachment_level := NEW.probing_depth + NEW.recession;

  ELSE

    NEW.clinical_attachment_level := NULL;

  END IF;

  RETURN NEW;

END;

$function$;