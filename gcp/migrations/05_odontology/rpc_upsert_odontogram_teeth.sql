CREATE OR REPLACE FUNCTION public.upsert_odontogram_teeth(p_odontogram_id uuid, p_teeth jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tooth JSONB;

  v_tenant_id UUID;

BEGIN

  -- Busca tenant_id do odontograma

  SELECT tenant_id INTO v_tenant_id

  FROM public.odontograms

  WHERE id = p_odontogram_id;



  -- Verifica permiss├úo

  IF NOT (

    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, v_tenant_id)

    OR public.is_dentist(current_setting('app.current_user_id')::uuid)

  ) THEN

    RAISE EXCEPTION 'Apenas dentistas podem editar odontogramas';

  END IF;



  -- Remove dentes existentes

  DELETE FROM public.odontogram_teeth WHERE odontogram_id = p_odontogram_id;



  -- Insere novos dentes

  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)

  LOOP

    INSERT INTO public.odontogram_teeth (

      odontogram_id,

      tooth_number,

      condition,

      surfaces,

      notes,

      procedure_date

    ) VALUES (

      p_odontogram_id,

      (v_tooth->>'tooth_number')::INTEGER,

      COALESCE(v_tooth->>'condition', 'healthy'),

      v_tooth->>'surfaces',

      v_tooth->>'notes',

      (v_tooth->>'procedure_date')::DATE

    );

  END LOOP;

END;

$function$;