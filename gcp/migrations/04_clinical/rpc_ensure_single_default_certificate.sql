CREATE OR REPLACE FUNCTION public.ensure_single_default_certificate()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  IF NEW.is_default = true THEN

    UPDATE public.profile_certificates

    SET is_default = false, updated_at = NOW()

    WHERE profile_id = NEW.profile_id

      AND id != NEW.id

      AND is_default = true;

  END IF;

  RETURN NEW;

END;

$function$;