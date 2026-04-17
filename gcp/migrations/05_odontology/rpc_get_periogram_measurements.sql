CREATE OR REPLACE FUNCTION public.get_periogram_measurements(p_periogram_id uuid)
 RETURNS TABLE(tooth_number integer, site text, probing_depth integer, recession integer, clinical_attachment_level integer, bleeding boolean, suppuration boolean, plaque boolean, mobility integer, furcation integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    pm.tooth_number,

    pm.site,

    pm.probing_depth,

    pm.recession,

    pm.clinical_attachment_level,

    pm.bleeding,

    pm.suppuration,

    pm.plaque,

    pm.mobility,

    pm.furcation

  FROM periogram_measurements pm

  JOIN periograms p ON pm.periogram_id = p.id

  WHERE pm.periogram_id = p_periogram_id

    AND p.tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid)

  ORDER BY pm.tooth_number, 

    CASE pm.site 

      WHEN 'MV' THEN 1 WHEN 'V' THEN 2 WHEN 'DV' THEN 3 

      WHEN 'ML' THEN 4 WHEN 'L' THEN 5 WHEN 'DL' THEN 6 

    END;

END;

$function$;