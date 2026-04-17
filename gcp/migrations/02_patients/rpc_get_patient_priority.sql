CREATE OR REPLACE FUNCTION public.get_patient_priority(p_patient_id uuid)
 RETURNS TABLE(priority integer, priority_label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_birth_date DATE;

  v_age INTEGER;

  v_is_pregnant BOOLEAN;

  v_is_pcd BOOLEAN;

BEGIN

  SELECT 

    COALESCE(c.date_of_birth, c.birth_date),

    LOWER(COALESCE(c.notes, '')) LIKE '%gestante%' 

      OR LOWER(COALESCE(c.notes, '')) LIKE '%gr├ívida%'

      OR LOWER(COALESCE(c.notes, '')) LIKE '%gravida%',

    LOWER(COALESCE(c.notes, '')) LIKE '%pcd%' 

      OR LOWER(COALESCE(c.notes, '')) LIKE '%deficiente%' 

      OR LOWER(COALESCE(c.notes, '')) LIKE '%cadeirante%'

      OR LOWER(COALESCE(c.notes, '')) LIKE '%defici├¬ncia%'

  INTO v_birth_date, v_is_pregnant, v_is_pcd

  FROM patients c

  WHERE c.id = p_patient_id;

  

  IF NOT FOUND THEN

    RETURN QUERY SELECT 5, 'Normal'::TEXT;

    RETURN;

  END IF;

  

  IF v_birth_date IS NOT NULL THEN

    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_birth_date));

  END IF;

  

  -- Prioridades (Estatuto do Idoso / Lei 10.048):

  IF v_age IS NOT NULL AND v_age >= 80 THEN

    RETURN QUERY SELECT 2, 'Idoso 80+'::TEXT;

  ELSIF v_is_pregnant THEN

    RETURN QUERY SELECT 2, 'Gestante'::TEXT;

  ELSIF v_is_pcd THEN

    RETURN QUERY SELECT 2, 'PCD'::TEXT;

  ELSIF v_age IS NOT NULL AND v_age >= 60 THEN

    RETURN QUERY SELECT 3, 'Idoso 60+'::TEXT;

  ELSE

    RETURN QUERY SELECT 5, 'Normal'::TEXT;

  END IF;

END;

$function$;