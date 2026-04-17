CREATE OR REPLACE FUNCTION public.upsert_patient(p_tenant_id uuid, p_name text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_cpf text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_marital_status text DEFAULT NULL::text, p_zip_code text DEFAULT NULL::text, p_street text DEFAULT NULL::text, p_street_number text DEFAULT NULL::text, p_complement text DEFAULT NULL::text, p_neighborhood text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_allergies text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_patient_id UUID;

BEGIN

  -- Tentar encontrar paciente existente por CPF ou telefone

  IF p_cpf IS NOT NULL AND p_cpf <> '' THEN

    SELECT id INTO v_patient_id

    FROM public.patients

    WHERE tenant_id = p_tenant_id AND cpf = p_cpf

    LIMIT 1;

  END IF;



  IF v_patient_id IS NULL AND p_phone IS NOT NULL AND p_phone <> '' THEN

    SELECT id INTO v_patient_id

    FROM public.patients

    WHERE tenant_id = p_tenant_id AND phone = p_phone

    LIMIT 1;

  END IF;



  IF v_patient_id IS NOT NULL THEN

    -- Atualizar paciente existente

    UPDATE public.patients

    SET

      name = COALESCE(p_name, name),

      phone = COALESCE(p_phone, phone),

      email = COALESCE(p_email, email),

      notes = COALESCE(p_notes, notes),

      cpf = COALESCE(p_cpf, cpf),

      date_of_birth = COALESCE(p_date_of_birth, date_of_birth),

      marital_status = COALESCE(p_marital_status, marital_status),

      zip_code = COALESCE(p_zip_code, zip_code),

      street = COALESCE(p_street, street),

      street_number = COALESCE(p_street_number, street_number),

      complement = COALESCE(p_complement, complement),

      neighborhood = COALESCE(p_neighborhood, neighborhood),

      city = COALESCE(p_city, city),

      state = COALESCE(p_state, state),

      allergies = COALESCE(p_allergies, allergies),

      updated_at = NOW()

    WHERE id = v_patient_id;

  ELSE

    -- Inserir novo paciente

    INSERT INTO public.patients (

      tenant_id, name, phone, email, notes, cpf,

      date_of_birth, marital_status, zip_code, street,

      street_number, complement, neighborhood, city, state, allergies

    )

    VALUES (

      p_tenant_id, p_name, p_phone, p_email, p_notes, p_cpf,

      p_date_of_birth, p_marital_status, p_zip_code, p_street,

      p_street_number, p_complement, p_neighborhood, p_city, p_state, p_allergies

    )

    RETURNING id INTO v_patient_id;

  END IF;



  RETURN v_patient_id;

END;

$function$;