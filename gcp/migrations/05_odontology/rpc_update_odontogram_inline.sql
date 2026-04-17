CREATE OR REPLACE FUNCTION public.update_odontogram_inline(p_odontogram_id uuid, p_notes text DEFAULT NULL::text, p_teeth jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id UUID;

  v_tooth JSONB;

BEGIN

  -- Busca tenant

  SELECT tenant_id INTO v_tenant_id

  FROM public.odontograms WHERE id = p_odontogram_id;



  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Odontograma n├úo encontrado';

  END IF;



  -- Verifica permiss├úo

  IF NOT (

    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, v_tenant_id)

    OR public.is_dentist(current_setting('app.current_user_id')::uuid)

  ) THEN

    RAISE EXCEPTION 'Permiss├úo negada';

  END IF;



  -- Atualiza notas se fornecido

  IF p_notes IS NOT NULL THEN

    UPDATE public.odontograms SET notes = p_notes, updated_at = NOW() WHERE id = p_odontogram_id;

  END IF;



  -- Upsert dentes

  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)

  LOOP

    INSERT INTO public.odontogram_teeth (

      odontogram_id, tooth_number, condition, surfaces, notes, 

      procedure_date, mobility_grade, priority

    ) VALUES (

      p_odontogram_id,

      (v_tooth->>'tooth_number')::INTEGER,

      COALESCE(v_tooth->>'condition', 'healthy'),

      v_tooth->>'surfaces',

      v_tooth->>'notes',

      (v_tooth->>'procedure_date')::DATE,

      (v_tooth->>'mobility_grade')::INTEGER,

      COALESCE(v_tooth->>'priority', 'normal')

    )

    ON CONFLICT (odontogram_id, tooth_number) DO UPDATE SET

      condition = EXCLUDED.condition,

      surfaces = EXCLUDED.surfaces,

      notes = EXCLUDED.notes,

      procedure_date = EXCLUDED.procedure_date,

      mobility_grade = EXCLUDED.mobility_grade,

      priority = EXCLUDED.priority,

      updated_at = NOW();

  END LOOP;

END;

$function$;