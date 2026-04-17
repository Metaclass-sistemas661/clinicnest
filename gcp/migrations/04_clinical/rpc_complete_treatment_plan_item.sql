CREATE OR REPLACE FUNCTION public.complete_treatment_plan_item(p_item_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_plan_id UUID;

  v_total_items INTEGER;

  v_completed_items INTEGER;

BEGIN

  UPDATE public.treatment_plan_items

  SET 

    status = 'concluido',

    completed_at = NOW(),

    completed_by = current_setting('app.current_user_id')::uuid,

    notes = COALESCE(p_notes, notes)

  WHERE id = p_item_id

  RETURNING plan_id INTO v_plan_id;

  

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluido')

  INTO v_total_items, v_completed_items

  FROM public.treatment_plan_items

  WHERE plan_id = v_plan_id;

  

  IF v_completed_items = v_total_items THEN

    UPDATE public.treatment_plans SET status = 'concluido' WHERE id = v_plan_id;

  ELSIF v_completed_items > 0 THEN

    UPDATE public.treatment_plans SET status = 'em_andamento' WHERE id = v_plan_id AND status = 'aprovado';

  END IF;

END;

$function$;