CREATE OR REPLACE FUNCTION public.protect_signed_prescription()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  IF OLD.signed_at IS NOT NULL THEN

    IF NEW.medications != OLD.medications 

       OR NEW.instructions IS DISTINCT FROM OLD.instructions

       OR NEW.prescription_type != OLD.prescription_type

       OR NEW.validity_days IS DISTINCT FROM OLD.validity_days

    THEN

      RAISE EXCEPTION 'N├úo ├® permitido alterar o conte├║do de uma receita assinada digitalmente.';

    END IF;

  END IF;

  

  RETURN NEW;

END;

$function$;