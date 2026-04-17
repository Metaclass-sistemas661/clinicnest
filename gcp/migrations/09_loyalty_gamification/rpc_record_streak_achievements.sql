CREATE OR REPLACE FUNCTION public.record_streak_achievements(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_rec RECORD;

  v_streak_count INT;

BEGIN

  FOR v_rec IN

    SELECT ga.goal_id, ga.professional_id, COUNT(*)::int as cnt

    FROM goal_achievements ga

    WHERE ga.tenant_id = p_tenant_id AND ga.achievement_type = 'goal_reached'

    GROUP BY ga.goal_id, ga.professional_id

    HAVING COUNT(*) >= 2

  LOOP

    v_streak_count := v_rec.cnt;



    -- Remove streak antigo e insere o atualizado (evita duplicados)

    DELETE FROM goal_achievements

    WHERE tenant_id = p_tenant_id AND goal_id = v_rec.goal_id

      AND (professional_id IS NOT DISTINCT FROM v_rec.professional_id)

      AND achievement_type = 'streak';



    INSERT INTO goal_achievements (tenant_id, goal_id, professional_id, achievement_type, metadata)

    VALUES (p_tenant_id, v_rec.goal_id, v_rec.professional_id, 'streak',

            jsonb_build_object('streak_count', v_streak_count));

  END LOOP;

END;

$function$;