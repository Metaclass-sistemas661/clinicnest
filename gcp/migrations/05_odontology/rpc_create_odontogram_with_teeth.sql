CREATE OR REPLACE FUNCTION public.create_odontogram_with_teeth(p_tenant_id uuid, p_client_id uuid, p_professional_id uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_exam_date date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL::text, p_teeth jsonb DEFAULT '[]'::jsonb, p_dentition_type text DEFAULT 'permanent'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_odontogram_id UUID;

  v_tooth JSONB;

BEGIN

  IF NOT (

    public.is_tenant_admin(current_setting('app.current_user_id')::uuid, p_tenant_id)

    OR public.is_dentist(current_setting('app.current_user_id')::uuid)

  ) THEN

    RAISE EXCEPTION 'Apenas dentistas podem criar odontogramas';

  END IF;



  INSERT INTO public.odontograms (

    tenant_id, patient_id, professional_id, appointment_id, exam_date, notes, dentition_type

  ) VALUES (

    p_tenant_id, p_client_id, p_professional_id, p_appointment_id, p_exam_date, p_notes,

    COALESCE(p_dentition_type, 'permanent')

  ) RETURNING id INTO v_odontogram_id;



  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)

  LOOP

    INSERT INTO public.odontogram_teeth (

      odontogram_id, tooth_number, condition, surfaces, notes,

      procedure_date, mobility_grade, priority

    ) VALUES (

      v_odontogram_id,

      (v_tooth->>'tooth_number')::INTEGER,

      COALESCE(v_tooth->>'condition', 'healthy'),

      v_tooth->>'surfaces',

      v_tooth->>'notes',

      (v_tooth->>'procedure_date')::DATE,

      (v_tooth->>'mobility_grade')::INTEGER,

      COALESCE(v_tooth->>'priority', 'normal')

    );

  END LOOP;



  RETURN v_odontogram_id;

END;

$function$;