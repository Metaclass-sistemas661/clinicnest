CREATE OR REPLACE FUNCTION public.protect_signed_certificate()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  -- Se o documento j├í estava assinado, impedir altera├º├Áes no conte├║do

  IF OLD.signed_at IS NOT NULL THEN

    -- Permitir apenas atualiza├º├úo de printed_at

    IF NEW.content != OLD.content 

       OR NEW.certificate_type != OLD.certificate_type

       OR NEW.days_off IS DISTINCT FROM OLD.days_off

       OR NEW.start_date IS DISTINCT FROM OLD.start_date

       OR NEW.end_date IS DISTINCT FROM OLD.end_date

       OR NEW.cid_code IS DISTINCT FROM OLD.cid_code

       OR NEW.notes IS DISTINCT FROM OLD.notes

    THEN

      RAISE EXCEPTION 'N├úo ├® permitido alterar o conte├║do de um atestado assinado digitalmente. Crie um novo documento.';

    END IF;

  END IF;

  

  RETURN NEW;

END;

$function$;