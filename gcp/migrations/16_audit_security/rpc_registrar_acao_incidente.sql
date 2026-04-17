CREATE OR REPLACE FUNCTION public.registrar_acao_incidente(p_incidente_id uuid, p_acao text, p_detalhes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  UPDATE lgpd_incidentes

  SET 

    timeline_acoes = timeline_acoes || jsonb_build_object(

      'timestamp', NOW(),

      'acao', p_acao,

      'detalhes', p_detalhes,

      'usuario', current_setting('app.current_user_id')::uuid

    ),

    updated_at = NOW()

  WHERE id = p_incidente_id;

  

  RETURN FOUND;

END;

$function$;