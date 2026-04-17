CREATE OR REPLACE FUNCTION public.record_goal_achievements_for_tenant(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_rec RECORD;

  v_inserted INT := 0;

  v_period_start TEXT;

  v_period_end TEXT;

  v_exists BOOLEAN;

BEGIN

  FOR v_rec IN

    SELECT g.id, g.name, g.period, g.professional_id, g.target_value,

           gp.current_value, gp.progress_pct, gp.period_start, gp.period_end

    FROM (

      SELECT * FROM get_goals_with_progress(p_tenant_id, false)

    ) gp

    JOIN goals g ON g.id = gp.id

    WHERE gp.progress_pct >= 100

  LOOP

    v_period_start := COALESCE(v_rec.period_start::text, '');

    v_period_end := COALESCE(v_rec.period_end::text, '');



    -- Verifica se j├í registrou para este goal + profissional + per├¡odo

    SELECT EXISTS (

      SELECT 1 FROM goal_achievements

      WHERE tenant_id = p_tenant_id

        AND goal_id = v_rec.id

        AND (professional_id IS NOT DISTINCT FROM v_rec.professional_id)

        AND achievement_type = 'goal_reached'

        AND metadata->>'period_start' = v_period_start

    ) INTO v_exists;



    IF NOT v_exists THEN

      INSERT INTO goal_achievements (tenant_id, goal_id, professional_id, achievement_type, metadata)

      VALUES (

        p_tenant_id,

        v_rec.id,

        v_rec.professional_id,

        'goal_reached',

        jsonb_build_object(

          'period_start', v_period_start,

          'period_end', v_period_end,

          'target_value', v_rec.target_value,

          'current_value', v_rec.current_value,

          'goal_name', v_rec.name

        )

      );

      v_inserted := v_inserted + 1;

    END IF;

  END LOOP;



  -- 2. Calcular e registrar streaks (2+ per├¡odos consecutivos)

  PERFORM record_streak_achievements(p_tenant_id);



  -- 3. Calcular e registrar n├¡veis (bronze, prata, ouro)

  PERFORM record_level_achievements(p_tenant_id);



  RETURN v_inserted;

END;

$function$;