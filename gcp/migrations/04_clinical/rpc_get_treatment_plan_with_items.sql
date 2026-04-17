CREATE OR REPLACE FUNCTION public.get_treatment_plan_with_items(p_plan_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_plan JSON;

  v_items JSON;

BEGIN

  SELECT row_to_json(p) INTO v_plan

  FROM (

    SELECT 

      tp.*,

      c.name as client_name,

      c.cpf as client_cpf,

      pr.full_name as professional_name,

      pr.council_number,

      pr.council_state

    FROM public.treatment_plans tp

    LEFT JOIN public.patients c ON c.id = tp.patient_id

    LEFT JOIN public.profiles pr ON pr.id = tp.professional_id

    WHERE tp.id = p_plan_id

  ) p;

  

  SELECT COALESCE(json_agg(i ORDER BY i.sort_order, i.tooth_number), '[]'::JSON) INTO v_items

  FROM public.treatment_plan_items i

  WHERE i.plan_id = p_plan_id;

  

  RETURN json_build_object('plan', v_plan, 'items', v_items);

END;

$function$;