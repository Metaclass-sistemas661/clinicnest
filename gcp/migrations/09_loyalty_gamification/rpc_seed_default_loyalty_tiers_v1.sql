CREATE OR REPLACE FUNCTION public.seed_default_loyalty_tiers_v1(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  INSERT INTO loyalty_tiers(tenant_id, name, min_points, discount_percent, color, icon, sort_order)

  VALUES

    (p_tenant_id, 'Bronze', 0,    0,    '#cd7f32', '­ƒÑë', 0),

    (p_tenant_id, 'Prata',  500,  5,    '#9ca3af', '­ƒÑê', 1),

    (p_tenant_id, 'Ouro',   2000, 10,   '#d97706', '­ƒÑç', 2)

  ON CONFLICT DO NOTHING;

END;

$function$;