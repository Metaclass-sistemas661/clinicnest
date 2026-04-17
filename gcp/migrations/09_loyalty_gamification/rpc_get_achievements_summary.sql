CREATE OR REPLACE FUNCTION public.get_achievements_summary(p_tenant_id uuid, p_professional_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(achievement_type text, goal_id uuid, goal_name text, professional_id uuid, professional_name text, achieved_at timestamp with time zone, metadata jsonb, level_name text, streak_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

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

$function$;