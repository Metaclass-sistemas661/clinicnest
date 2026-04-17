CREATE OR REPLACE FUNCTION public.get_health_credits_leaderboard(p_tenant_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(patient_id uuid, patient_name text, balance integer, lifetime_earned integer, lifetime_redeemed integer, tier text, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT

    b.patient_id,

    COALESCE(c.name, 'Paciente') AS patient_name,

    b.balance,

    b.lifetime_earned,

    b.lifetime_redeemed,

    b.tier,

    b.updated_at

  FROM public.health_credits_balance b

  JOIN public.patients c ON c.id = b.patient_id

  WHERE b.tenant_id = p_tenant_id

    AND b.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = current_setting('app.current_user_id')::uuid)

  ORDER BY b.lifetime_earned DESC

  LIMIT p_limit;

$function$;