CREATE OR REPLACE FUNCTION public.calculate_periogram_indices(p_periogram_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_total_sites INTEGER;

  v_plaque_count INTEGER;

  v_bleeding_count INTEGER;

  v_avg_depth DECIMAL(4,2);

  v_sites_over_4 INTEGER;

  v_sites_over_6 INTEGER;

BEGIN

  SELECT 

    COUNT(*),

    COUNT(*) FILTER (WHERE plaque = TRUE),

    COUNT(*) FILTER (WHERE bleeding = TRUE),

    AVG(probing_depth),

    COUNT(*) FILTER (WHERE probing_depth > 4),

    COUNT(*) FILTER (WHERE probing_depth > 6)

  INTO 

    v_total_sites,

    v_plaque_count,

    v_bleeding_count,

    v_avg_depth,

    v_sites_over_4,

    v_sites_over_6

  FROM periogram_measurements

  WHERE periogram_id = p_periogram_id

    AND probing_depth IS NOT NULL;



  UPDATE periograms

  SET 

    total_sites = v_total_sites,

    plaque_index = CASE WHEN v_total_sites > 0 THEN (v_plaque_count::DECIMAL / v_total_sites) * 100 ELSE 0 END,

    bleeding_index = CASE WHEN v_total_sites > 0 THEN (v_bleeding_count::DECIMAL / v_total_sites) * 100 ELSE 0 END,

    avg_probing_depth = COALESCE(v_avg_depth, 0),

    sites_over_4mm = v_sites_over_4,

    sites_over_6mm = v_sites_over_6,

    updated_at = NOW()

  WHERE id = p_periogram_id;

END;

$function$;