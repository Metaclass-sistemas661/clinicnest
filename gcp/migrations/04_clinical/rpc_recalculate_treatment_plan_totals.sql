CREATE OR REPLACE FUNCTION public.recalculate_treatment_plan_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

DECLARE

  v_total DECIMAL(12,2);

  v_plan_discount DECIMAL(5,2);

  v_discount_val DECIMAL(12,2);

BEGIN

  SELECT COALESCE(SUM(total_price), 0) INTO v_total

  FROM public.treatment_plan_items

  WHERE plan_id = COALESCE(NEW.plan_id, OLD.plan_id);

  

  SELECT discount_percent INTO v_plan_discount

  FROM public.treatment_plans

  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);

  

  v_discount_val := v_total * COALESCE(v_plan_discount, 0) / 100;

  

  UPDATE public.treatment_plans

  SET 

    total_value = v_total,

    discount_value = v_discount_val,

    final_value = v_total - v_discount_val

  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);

  

  RETURN COALESCE(NEW, OLD);

END;

$function$;