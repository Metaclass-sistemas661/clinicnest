CREATE OR REPLACE FUNCTION public.submit_ai_feedback(p_interaction_id uuid, p_feedback text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF p_feedback NOT IN ('accepted', 'rejected', 'partial') THEN

    RAISE EXCEPTION 'Feedback inv├ílido: %', p_feedback;

  END IF;



  UPDATE public.ai_performance_metrics

  SET user_feedback = p_feedback

  WHERE interaction_id = p_interaction_id

    AND tenant_id IN (

      SELECT p.tenant_id FROM public.profiles p WHERE p.id = current_setting('app.current_user_id')::uuid

    );

END;

$function$;