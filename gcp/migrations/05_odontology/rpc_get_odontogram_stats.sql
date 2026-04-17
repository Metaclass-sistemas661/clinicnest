CREATE OR REPLACE FUNCTION public.get_odontogram_stats(p_tenant_id uuid, p_patient_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_result JSONB;

  v_latest_id UUID;

BEGIN

  -- Pega o odontograma mais recente

  SELECT id INTO v_latest_id

  FROM public.odontograms

  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id

  ORDER BY exam_date DESC, created_at DESC

  LIMIT 1;



  IF v_latest_id IS NULL THEN

    RETURN jsonb_build_object(

      'has_odontogram', false,

      'total_exams', 0

    );

  END IF;



  SELECT jsonb_build_object(

    'has_odontogram', true,

    'latest_odontogram_id', v_latest_id,

    'total_exams', (SELECT COUNT(*) FROM public.odontograms WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),

    'total_teeth_registered', COUNT(*),

    'healthy', COUNT(*) FILTER (WHERE condition = 'healthy'),

    'caries', COUNT(*) FILTER (WHERE condition = 'caries'),

    'restored', COUNT(*) FILTER (WHERE condition = 'restored'),

    'missing', COUNT(*) FILTER (WHERE condition = 'missing'),

    'crown', COUNT(*) FILTER (WHERE condition = 'crown'),

    'implant', COUNT(*) FILTER (WHERE condition = 'implant'),

    'endodontic', COUNT(*) FILTER (WHERE condition = 'endodontic'),

    'extraction', COUNT(*) FILTER (WHERE condition = 'extraction'),

    'prosthesis', COUNT(*) FILTER (WHERE condition = 'prosthesis'),

    'fracture', COUNT(*) FILTER (WHERE condition = 'fracture'),

    'urgent_teeth', COUNT(*) FILTER (WHERE priority = 'urgent'),

    'high_priority_teeth', COUNT(*) FILTER (WHERE priority = 'high'),

    'mobility_teeth', COUNT(*) FILTER (WHERE mobility_grade > 0),

    'caries_rate_pct', ROUND(COUNT(*) FILTER (WHERE condition = 'caries')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),

    'healthy_rate_pct', ROUND(COUNT(*) FILTER (WHERE condition = 'healthy')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1)

  ) INTO v_result

  FROM public.odontogram_teeth

  WHERE odontogram_id = v_latest_id;



  RETURN v_result;

END;

$function$;