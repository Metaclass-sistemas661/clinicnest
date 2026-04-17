CREATE OR REPLACE FUNCTION public.calc_ocupacao_salas(p_tenant_id uuid, p_inicio date, p_fim date)
 RETURNS TABLE(taxa numeric, horas_disp numeric, horas_ocup numeric, por_sala jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_dias INTEGER;

  v_salas INTEGER;

  v_horas_dia NUMERIC := 10; -- 10 horas ├║teis por dia

  v_horas_disp NUMERIC;

  v_horas_ocup NUMERIC;

  v_por_sala JSONB;

BEGIN

  -- Calcula dias ├║teis no per├¡odo (simplificado)

  v_dias := (p_fim - p_inicio) + 1;

  

  -- Conta salas ativas

  SELECT COUNT(*) INTO v_salas

  FROM rooms

  WHERE tenant_id = p_tenant_id AND is_active = true;

  

  v_horas_disp := v_dias * v_salas * v_horas_dia;

  

  -- Calcula horas ocupadas

  SELECT COALESCE(SUM(

    EXTRACT(EPOCH FROM (

      COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time

    )) / 3600

  ), 0) INTO v_horas_ocup

  FROM room_occupancies ro

  JOIN rooms r ON r.id = ro.room_id

  WHERE r.tenant_id = p_tenant_id

    AND ro.start_time::DATE BETWEEN p_inicio AND p_fim;

  

  -- Ocupa├º├úo por sala

  SELECT COALESCE(jsonb_object_agg(

    r.id::TEXT,

    jsonb_build_object(

      'nome', r.name,

      'horas', ROUND(SUM(EXTRACT(EPOCH FROM (

        COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time

      )) / 3600)::NUMERIC, 2),

      'taxa', ROUND((SUM(EXTRACT(EPOCH FROM (

        COALESCE(ro.end_time, ro.start_time + INTERVAL '1 hour') - ro.start_time

      )) / 3600) / (v_dias * v_horas_dia) * 100)::NUMERIC, 2)

    )

  ), '{}') INTO v_por_sala

  FROM rooms r

  LEFT JOIN room_occupancies ro ON ro.room_id = r.id 

    AND ro.start_time::DATE BETWEEN p_inicio AND p_fim

  WHERE r.tenant_id = p_tenant_id AND r.is_active = true

  GROUP BY r.id, r.name;

  

  RETURN QUERY SELECT 

    ROUND((v_horas_ocup / NULLIF(v_horas_disp, 0) * 100), 2),

    ROUND(v_horas_disp, 2),

    ROUND(v_horas_ocup, 2),

    v_por_sala;

END;

$function$;