CREATE OR REPLACE FUNCTION public.lookup_cns_by_cpf(p_cpf character varying)
 RETURNS character varying
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN (

    SELECT cns FROM clients 

    WHERE cpf = p_cpf AND cns IS NOT NULL

    LIMIT 1

  );

END;

$function$;