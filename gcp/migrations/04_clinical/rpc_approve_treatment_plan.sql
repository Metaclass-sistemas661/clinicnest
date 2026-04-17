CREATE OR REPLACE FUNCTION public.approve_treatment_plan(p_plan_id uuid, p_signature text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE public.treatment_plans

  SET 

    status = 'aprovado',

    approved_at = NOW(),

    approved_by_client = TRUE,

    client_signature = p_signature,

    signature_ip = p_ip

  WHERE id = p_plan_id AND status IN ('pendente', 'apresentado');

END;

$function$;