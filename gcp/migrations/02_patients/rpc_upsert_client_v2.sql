-- RPC: upsert_client_v2
-- Creates or updates a patient record, auto-generates access_code on INSERT
-- Called by: server.ts /api/patients endpoint (clinic staff creating/editing patients)

CREATE OR REPLACE FUNCTION public.upsert_client_v2(
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_patient_id uuid DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_street text DEFAULT NULL,
  p_street_number text DEFAULT NULL,
  p_complement text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_allergies text DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_access_code text;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado.' USING ERRCODE = 'P0001';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'O nome do paciente é obrigatório.' USING ERRCODE = 'P0001';
  END IF;

  IF p_patient_id IS NULL THEN
    -- CREATE new patient
    v_action := 'patient_created';
    INSERT INTO public.patients(
      tenant_id, name, phone, email, notes, cpf,
      date_of_birth, marital_status, zip_code, street,
      street_number, complement, neighborhood, city, state, allergies
    )
    VALUES(
      v_profile.tenant_id, p_name,
      NULLIF(p_phone,''), NULLIF(p_email,''), NULLIF(p_notes,''),
      NULLIF(btrim(p_cpf),''), p_date_of_birth,
      NULLIF(btrim(p_marital_status),''), NULLIF(btrim(p_zip_code),''),
      NULLIF(btrim(p_street),''), NULLIF(btrim(p_street_number),''),
      NULLIF(btrim(p_complement),''), NULLIF(btrim(p_neighborhood),''),
      NULLIF(btrim(p_city),''), NULLIF(btrim(p_state),''),
      NULLIF(btrim(p_allergies),'')
    )
    RETURNING id, access_code INTO v_id, v_access_code;
  ELSE
    -- UPDATE existing patient
    v_action := 'patient_updated';
    UPDATE public.patients SET
      name = p_name,
      phone = NULLIF(p_phone,''),
      email = NULLIF(p_email,''),
      notes = NULLIF(p_notes,''),
      cpf = NULLIF(btrim(p_cpf),''),
      date_of_birth = p_date_of_birth,
      marital_status = NULLIF(btrim(p_marital_status),''),
      zip_code = NULLIF(btrim(p_zip_code),''),
      street = NULLIF(btrim(p_street),''),
      street_number = NULLIF(btrim(p_street_number),''),
      complement = NULLIF(btrim(p_complement),''),
      neighborhood = NULLIF(btrim(p_neighborhood),''),
      city = NULLIF(btrim(p_city),''),
      state = NULLIF(btrim(p_state),''),
      allergies = NULLIF(btrim(p_allergies),''),
      updated_at = now()
    WHERE id = p_patient_id AND tenant_id = v_profile.tenant_id
    RETURNING id, access_code INTO v_id, v_access_code;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Paciente não encontrado ou sem permissão.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'patient_id', v_id, 'access_code', v_access_code);
END;
$function$;
