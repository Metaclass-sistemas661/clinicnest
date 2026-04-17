CREATE OR REPLACE FUNCTION public.get_dental_dashboard(p_tenant_id uuid, p_start_date date DEFAULT ((CURRENT_DATE - '30 days'::interval))::date, p_end_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  result JSONB;

BEGIN

  -- Verify access

  IF public.get_user_tenant_id(current_setting('app.current_user_id')::uuid) != p_tenant_id THEN

    RAISE EXCEPTION 'Acesso negado';

  END IF;



  SELECT jsonb_build_object(

    'teeth_treated', (

      SELECT COUNT(DISTINCT ot.tooth_number) 

      FROM odontograms o 

      JOIN odontogram_teeth ot ON ot.odontogram_id = o.id

      WHERE o.tenant_id = p_tenant_id 

        AND o.exam_date BETWEEN p_start_date AND p_end_date

        AND ot.condition != 'healthy'

    ),

    'odontograms_created', (

      SELECT COUNT(*) FROM odontograms 

      WHERE tenant_id = p_tenant_id 

        AND exam_date BETWEEN p_start_date AND p_end_date

    ),

    'periograms_created', (

      SELECT COUNT(*) FROM periograms 

      WHERE tenant_id = p_tenant_id 

        AND exam_date BETWEEN p_start_date AND p_end_date

    ),

    'plans_pending', (

      SELECT COUNT(*) FROM treatment_plans 

      WHERE tenant_id = p_tenant_id 

        AND status IN ('pendente', 'apresentado')

    ),

    'plans_in_progress', (

      SELECT COUNT(*) FROM treatment_plans 

      WHERE tenant_id = p_tenant_id 

        AND status = 'em_andamento'

    ),

    'plans_completed', (

      SELECT COUNT(*) FROM treatment_plans 

      WHERE tenant_id = p_tenant_id 

        AND status = 'concluido'

        AND updated_at >= p_start_date

    ),

    'top_conditions', (

      SELECT COALESCE(jsonb_agg(jsonb_build_object('condition', condition, 'count', cnt)), '[]')

      FROM (

        SELECT ot.condition, COUNT(*) AS cnt

        FROM odontograms o

        JOIN odontogram_teeth ot ON ot.odontogram_id = o.id

        WHERE o.tenant_id = p_tenant_id

          AND o.exam_date BETWEEN p_start_date AND p_end_date

          AND ot.condition != 'healthy'

        GROUP BY ot.condition

        ORDER BY cnt DESC

        LIMIT 10

      ) sub

    ),

    'urgent_teeth', (

      SELECT COUNT(*) 

      FROM odontograms o

      JOIN odontogram_teeth ot ON ot.odontogram_id = o.id

      WHERE o.tenant_id = p_tenant_id

        AND ot.priority = 'urgent'

        AND o.id IN (

          SELECT DISTINCT ON (o2.client_id) o2.id 

          FROM odontograms o2 

          WHERE o2.tenant_id = p_tenant_id

          ORDER BY o2.client_id, o2.exam_date DESC

        )

    )

  ) INTO result;



  RETURN result;

END;

$function$;