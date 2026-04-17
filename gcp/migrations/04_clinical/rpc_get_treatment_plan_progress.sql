CREATE OR REPLACE FUNCTION public.get_treatment_plan_progress(p_plan_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$

  SELECT json_build_object(

    'total_items', COUNT(*),

    'completed_items', COUNT(*) FILTER (WHERE status = 'concluido'),

    'pending_items', COUNT(*) FILTER (WHERE status = 'pendente'),

    'scheduled_items', COUNT(*) FILTER (WHERE status = 'agendado'),

    'in_progress_items', COUNT(*) FILTER (WHERE status = 'em_andamento'),

    'cancelled_items', COUNT(*) FILTER (WHERE status = 'cancelado'),

    'completion_percent', CASE WHEN COUNT(*) > 0 

      THEN ROUND((COUNT(*) FILTER (WHERE status = 'concluido')::DECIMAL / COUNT(*)) * 100, 1)

      ELSE 0 END,

    'total_value', SUM(total_price),

    'completed_value', SUM(total_price) FILTER (WHERE status = 'concluido')

  )

  FROM public.treatment_plan_items

  WHERE plan_id = p_plan_id;

$function$;