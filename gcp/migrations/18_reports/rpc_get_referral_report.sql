CREATE OR REPLACE FUNCTION public.get_referral_report(p_tenant_id uuid, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_referrer_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(referrer_id uuid, referrer_name text, referrer_role text, month timestamp with time zone, total_appointments bigint, unique_patients bigint, completed_appointments bigint, total_revenue numeric, total_commission numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

    RETURN QUERY

    SELECT 

        v.referrer_id,

        v.referrer_name::text,

        v.referrer_role::text,

        v.month,

        v.total_appointments,

        v.unique_patients,

        v.completed_appointments,

        v.total_revenue,

        v.total_commission

    FROM public.v_referral_report v

    WHERE v.tenant_id = p_tenant_id

    AND (p_from_date IS NULL OR v.month >= p_from_date::timestamptz)

    AND (p_to_date IS NULL OR v.month <= (p_to_date + INTERVAL '1 day')::timestamptz)

    AND (p_referrer_id IS NULL OR v.referrer_id = p_referrer_id)

    ORDER BY v.month DESC, v.total_revenue DESC;

END;

$function$;