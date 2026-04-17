CREATE OR REPLACE FUNCTION public.process_hl7_lab_result(p_tenant_id uuid, p_connection_id uuid, p_raw_message text, p_parsed_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

    v_log_id UUID;

    v_client_id UUID;

    v_exam_result_id UUID;

    v_patient_data JSONB;

    v_results JSONB;

    v_external_patient_id TEXT;

    v_patient_cpf TEXT;

    v_patient_name TEXT;

BEGIN

    -- Create log entry

    INSERT INTO hl7_message_log (

        connection_id, tenant_id, direction, message_type, 

        message_control_id, raw_message, parsed_data, status

    ) VALUES (

        p_connection_id, p_tenant_id, 'inbound', 

        p_parsed_data->>'messageType',

        p_parsed_data->>'messageControlId',

        p_raw_message, p_parsed_data, 'processing'

    ) RETURNING id INTO v_log_id;

    

    -- Extract patient data

    v_patient_data := p_parsed_data->'patient';

    v_external_patient_id := v_patient_data->>'id';

    v_patient_cpf := v_patient_data->>'cpf';

    v_patient_name := v_patient_data->>'name';

    

    -- Try to find existing patient mapping

    SELECT client_id INTO v_client_id

    FROM hl7_patient_mapping

    WHERE tenant_id = p_tenant_id

      AND external_patient_id = v_external_patient_id

    LIMIT 1;

    

    -- If not found, try to match by CPF

    IF v_client_id IS NULL AND v_patient_cpf IS NOT NULL THEN

        SELECT id INTO v_client_id

        FROM clients

        WHERE tenant_id = p_tenant_id

          AND cpf = v_patient_cpf

        LIMIT 1;

        

        -- Create mapping if found

        IF v_client_id IS NOT NULL THEN

            INSERT INTO hl7_patient_mapping (

                tenant_id, connection_id, external_patient_id, 

                external_system, client_id, matched_by, confidence_score

            ) VALUES (

                p_tenant_id, p_connection_id, v_external_patient_id,

                (SELECT receiving_application FROM hl7_connections WHERE id = p_connection_id),

                v_client_id, 'cpf', 1.00

            ) ON CONFLICT DO NOTHING;

        END IF;

    END IF;

    

    -- If still not found, try fuzzy match by name (simplified)

    IF v_client_id IS NULL AND v_patient_name IS NOT NULL THEN

        SELECT id INTO v_client_id

        FROM clients

        WHERE tenant_id = p_tenant_id

          AND LOWER(full_name) = LOWER(v_patient_name)

        LIMIT 1;

        

        IF v_client_id IS NOT NULL THEN

            INSERT INTO hl7_patient_mapping (

                tenant_id, connection_id, external_patient_id,

                external_system, client_id, matched_by, confidence_score

            ) VALUES (

                p_tenant_id, p_connection_id, v_external_patient_id,

                (SELECT receiving_application FROM hl7_connections WHERE id = p_connection_id),

                v_client_id, 'name_dob', 0.80

            ) ON CONFLICT DO NOTHING;

        END IF;

    END IF;

    

    -- Extract results

    v_results := p_parsed_data->'results';

    

    -- Create exam_result if patient found

    IF v_client_id IS NOT NULL AND jsonb_array_length(v_results) > 0 THEN

        INSERT INTO exam_results (

            tenant_id, client_id, exam_type, exam_date,

            result_summary, result_data, status, source

        ) VALUES (

            p_tenant_id, v_client_id,

            COALESCE(p_parsed_data->'order'->>'tests'->0->>'name', 'Exame Laboratorial'),

            COALESCE((p_parsed_data->'order'->>'orderDateTime')::timestamptz, NOW()),

            'Resultado recebido via HL7',

            v_results,

            'completed',

            'hl7'

        ) RETURNING id INTO v_exam_result_id;

        

        -- Update log with linked records

        UPDATE hl7_message_log SET

            status = 'processed',

            patient_id = v_client_id,

            exam_result_id = v_exam_result_id,

            processed_at = NOW()

        WHERE id = v_log_id;

    ELSE

        -- Mark as needing manual review

        UPDATE hl7_message_log SET

            status = 'failed',

            error_message = CASE 

                WHEN v_client_id IS NULL THEN 'Paciente n├úo encontrado no sistema'

                ELSE 'Nenhum resultado na mensagem'

            END,

            processed_at = NOW()

        WHERE id = v_log_id;

    END IF;

    

    RETURN v_log_id;

END;

$function$;