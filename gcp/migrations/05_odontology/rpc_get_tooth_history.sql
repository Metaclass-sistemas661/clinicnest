CREATE OR REPLACE FUNCTION public.get_tooth_history(p_odontogram_id uuid, p_tooth_number integer)
 RETURNS TABLE(id uuid, previous_condition text, new_condition text, previous_surfaces text, new_surfaces text, changed_by uuid, changed_by_name text, changed_at timestamp with time zone, change_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    h.id,

    h.previous_condition,

    h.new_condition,

    h.previous_surfaces,

    h.new_surfaces,

    h.changed_by,

    p.full_name AS changed_by_name,

    h.changed_at,

    h.change_reason

  FROM public.odontogram_tooth_history h

  JOIN public.profiles p ON p.id = h.changed_by

  JOIN public.odontograms o ON o.id = h.odontogram_id

  WHERE h.odontogram_id = p_odontogram_id

    AND h.tooth_number = p_tooth_number

    AND o.tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid)

  ORDER BY h.changed_at DESC;

END;

$function$;