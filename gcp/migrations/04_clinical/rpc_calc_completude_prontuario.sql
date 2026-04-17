CREATE OR REPLACE FUNCTION public.calc_completude_prontuario(p_tenant_id uuid, p_inicio date, p_fim date)
 RETURNS TABLE(completude numeric, total integer, completos integer, campos_faltantes jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_total INTEGER;

  v_completos INTEGER;

  v_campos JSONB := '{}';

BEGIN

  -- Conta prontu├írios do per├¡odo

  SELECT COUNT(*) INTO v_total

  FROM medical_records

  WHERE tenant_id = p_tenant_id

    AND created_at::DATE BETWEEN p_inicio AND p_fim;

  

  -- Conta prontu├írios com campos obrigat├│rios preenchidos

  SELECT COUNT(*) INTO v_completos

  FROM medical_records

  WHERE tenant_id = p_tenant_id

    AND created_at::DATE BETWEEN p_inicio AND p_fim

    AND subjective IS NOT NULL AND subjective != ''

    AND objective IS NOT NULL AND objective != ''

    AND assessment IS NOT NULL AND assessment != ''

    AND plan IS NOT NULL AND plan != '';

  

  -- Conta campos faltantes

  SELECT jsonb_build_object(

    'subjective', COUNT(*) FILTER (WHERE subjective IS NULL OR subjective = ''),

    'objective', COUNT(*) FILTER (WHERE objective IS NULL OR objective = ''),

    'assessment', COUNT(*) FILTER (WHERE assessment IS NULL OR assessment = ''),

    'plan', COUNT(*) FILTER (WHERE plan IS NULL OR plan = '')

  ) INTO v_campos

  FROM medical_records

  WHERE tenant_id = p_tenant_id

    AND created_at::DATE BETWEEN p_inicio AND p_fim;

  

  RETURN QUERY SELECT 

    ROUND((v_completos::NUMERIC / NULLIF(v_total, 0) * 100), 2),

    v_total,

    v_completos,

    v_campos;

END;

$function$;