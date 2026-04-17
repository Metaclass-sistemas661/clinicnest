CREATE OR REPLACE FUNCTION public.archive_client_clinical_data(p_client_id uuid, p_export_pdf_url text DEFAULT NULL::text, p_export_xml_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_client RECORD;

  v_medical_records JSONB;

  v_prescriptions JSONB;

  v_triages JSONB;

  v_evolutions JSONB;

  v_archive_id UUID;

  v_data_hash TEXT;

  v_all_data JSONB;

BEGIN

  -- Busca dados do cliente

  SELECT * INTO v_client FROM clients WHERE id = p_client_id;

  

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Cliente n├úo encontrado';

  END IF;

  

  -- Verifica se pode arquivar (per├¡odo de reten├º├úo expirado)

  IF v_client.retention_expires_at IS NULL OR v_client.retention_expires_at > CURRENT_DATE THEN

    RAISE EXCEPTION 'N├úo ├® permitido arquivar: per├¡odo de reten├º├úo ainda n├úo expirou (expira em %)',

      COALESCE(TO_CHAR(v_client.retention_expires_at, 'DD/MM/YYYY'), 'data n├úo definida');

  END IF;

  

  -- Coleta prontu├írios

  SELECT COALESCE(jsonb_agg(row_to_json(mr)), '[]'::JSONB)

  INTO v_medical_records

  FROM medical_records mr

  WHERE mr.client_id = p_client_id;

  

  -- Coleta prescri├º├Áes

  SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::JSONB)

  INTO v_prescriptions

  FROM prescriptions p

  JOIN medical_records mr ON mr.id = p.medical_record_id

  WHERE mr.client_id = p_client_id;

  

  -- Coleta triagens

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)

  INTO v_triages

  FROM triage_records t

  WHERE t.client_id = p_client_id;

  

  -- Coleta evolu├º├Áes (se existir)

  v_evolutions := '[]'::JSONB;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_evolutions') THEN

    EXECUTE format('

      SELECT COALESCE(jsonb_agg(row_to_json(e)), ''[]''::JSONB)

      FROM clinical_evolutions e

      WHERE e.client_id = $1

    ') INTO v_evolutions USING p_client_id;

  END IF;

  

  -- Monta JSON completo para hash

  v_all_data := jsonb_build_object(

    'client', row_to_json(v_client),

    'medical_records', v_medical_records,

    'prescriptions', v_prescriptions,

    'triages', v_triages,

    'evolutions', v_evolutions

  );

  

  -- Gera hash de integridade

  v_data_hash := encode(sha256(v_all_data::TEXT::BYTEA), 'hex');

  

  -- Insere no arquivo

  INSERT INTO archived_clinical_data (

    tenant_id, client_id, client_name, client_cpf, client_cns, client_birth_date,

    medical_records, prescriptions, triages, evolutions,

    last_appointment_date, retention_expired_at, archived_by,

    export_pdf_url, export_xml_url, export_generated_at,

    data_hash, can_be_deleted_after

  ) VALUES (

    v_client.tenant_id, p_client_id, v_client.name, v_client.cpf, v_client.cns, v_client.birth_date,

    v_medical_records, v_prescriptions, v_triages, v_evolutions,

    v_client.last_appointment_date, v_client.retention_expires_at, current_setting('app.current_user_id')::uuid,

    p_export_pdf_url, p_export_xml_url, 

    CASE WHEN p_export_pdf_url IS NOT NULL OR p_export_xml_url IS NOT NULL THEN NOW() ELSE NULL END,

    v_data_hash, CURRENT_DATE + INTERVAL '5 years'

  ) RETURNING id INTO v_archive_id;

  

  -- Remove dados originais (agora permitido pois passou do per├¡odo)

  -- Primeiro remove depend├¬ncias

  DELETE FROM prescriptions WHERE medical_record_id IN (

    SELECT id FROM medical_records WHERE client_id = p_client_id

  );

  DELETE FROM triage_records WHERE client_id = p_client_id;

  

  -- Remove evolu├º├Áes se existir

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_evolutions') THEN

    EXECUTE 'DELETE FROM clinical_evolutions WHERE client_id = $1' USING p_client_id;

  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nursing_evolutions') THEN

    EXECUTE 'DELETE FROM nursing_evolutions WHERE client_id = $1' USING p_client_id;

  END IF;

  

  -- Remove prontu├írios

  DELETE FROM medical_records WHERE client_id = p_client_id;

  

  -- Marca cliente como arquivado (n├úo exclui o cadastro b├ísico)

  UPDATE clients 

  SET 

    notes = COALESCE(notes, '') || E'\n[ARQUIVADO em ' || TO_CHAR(NOW(), 'DD/MM/YYYY') || ' - ID: ' || v_archive_id || ']',

    updated_at = NOW()

  WHERE id = p_client_id;

  

  RETURN v_archive_id;

END;

$function$;