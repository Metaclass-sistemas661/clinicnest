CREATE OR REPLACE FUNCTION public.record_level_achievements(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_rec RECORD;

  v_level TEXT;

  v_total INT;

  v_goal_id UUID;

BEGIN

  SELECT id INTO v_goal_id FROM goals WHERE tenant_id = p_tenant_id AND is_active = true LIMIT 1;

  IF v_goal_id IS NULL THEN RETURN; END IF;



  -- Por profissional (inclui professional_id IS NULL para metas gerais)

  FOR v_rec IN

    SELECT professional_id, COUNT(*)::int as total

    FROM goal_achievements

    WHERE tenant_id = p_tenant_id AND achievement_type = 'goal_reached'

    GROUP BY professional_id

  LOOP

    v_total := v_rec.total;

    v_level := CASE

      WHEN v_total >= 5 THEN 'ouro'

      WHEN v_total >= 3 THEN 'prata'

      WHEN v_total >= 1 THEN 'bronze'

      ELSE NULL

    END;



    IF v_level IS NOT NULL THEN

      DELETE FROM goal_achievements

      WHERE tenant_id = p_tenant_id AND (professional_id IS NOT DISTINCT FROM v_rec.professional_id)

        AND achievement_type = 'level';



      INSERT INTO goal_achievements (tenant_id, goal_id, professional_id, achievement_type, metadata)

      VALUES (p_tenant_id, v_goal_id, v_rec.professional_id, 'level',

              jsonb_build_object('level', v_level, 'total_goals_reached', v_total));

    END IF;

  END LOOP;

END;

$function$;