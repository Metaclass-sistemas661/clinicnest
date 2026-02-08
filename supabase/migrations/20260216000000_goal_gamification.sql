-- Gamificação avançada: registrar conquistas, streaks, níveis

-- 1. Função para registrar conquistas (goal_reached) quando meta atinge 100%
CREATE OR REPLACE FUNCTION public.record_goal_achievements_for_tenant(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Verifica se já registrou para este goal + profissional + período
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

  -- 2. Calcular e registrar streaks (2+ períodos consecutivos)
  PERFORM record_streak_achievements(p_tenant_id);

  -- 3. Calcular e registrar níveis (bronze, prata, ouro)
  PERFORM record_level_achievements(p_tenant_id);

  RETURN v_inserted;
END;
$$;

-- 2. Função auxiliar: registrar streaks (2+ metas atingidas para mesma goal+professional)
CREATE OR REPLACE FUNCTION public.record_streak_achievements(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 3. Função auxiliar: registrar níveis (bronze=1+, prata=3+, ouro=5+ conquistas)
CREATE OR REPLACE FUNCTION public.record_level_achievements(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 4. Função para buscar resumo de conquistas para exibição
CREATE OR REPLACE FUNCTION public.get_achievements_summary(
  p_tenant_id UUID,
  p_professional_id UUID DEFAULT NULL
)
RETURNS TABLE (
  achievement_type TEXT,
  goal_id UUID,
  goal_name TEXT,
  professional_id UUID,
  professional_name TEXT,
  achieved_at TIMESTAMPTZ,
  metadata JSONB,
  level_name TEXT,
  streak_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.achievement_type,
    ga.goal_id,
    COALESCE((ga.metadata->>'goal_name')::text, g.name) as goal_name,
    ga.professional_id,
    p.full_name as professional_name,
    ga.achieved_at,
    ga.metadata,
    CASE ga.achievement_type
      WHEN 'level' THEN ga.metadata->>'level'
      ELSE NULL
    END as level_name,
    CASE ga.achievement_type
      WHEN 'streak' THEN (ga.metadata->>'streak_count')::int
      ELSE NULL
    END as streak_count
  FROM goal_achievements ga
  LEFT JOIN goals g ON g.id = ga.goal_id
  LEFT JOIN profiles p ON p.id = ga.professional_id AND p.tenant_id = ga.tenant_id
  WHERE ga.tenant_id = p_tenant_id
    AND (p_professional_id IS NULL OR ga.professional_id = p_professional_id)
  ORDER BY ga.achieved_at DESC;
END;
$$;
