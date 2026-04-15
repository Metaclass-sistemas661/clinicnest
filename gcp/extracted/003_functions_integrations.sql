-- GCP Migration: Functions - integrations
-- Total: 11 functions


-- ============================================
-- Function: update_nfse_invoices_updated_at
-- Source: 20260324700001_nfse_nfeio_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_nfse_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: get_tenant_rnds_config
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_rnds_config()
RETURNS TABLE (
  rnds_enabled BOOLEAN,
  rnds_cnes VARCHAR,
  rnds_uf VARCHAR,
  rnds_environment VARCHAR,
  rnds_auto_send BOOLEAN,
  rnds_last_sync_at TIMESTAMPTZ,
  has_certificate BOOLEAN,
  certificate_valid_to TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  RETURN QUERY
  SELECT 
    t.rnds_enabled,
    t.rnds_cnes,
    t.rnds_uf,
    t.rnds_environment,
    t.rnds_auto_send,
    t.rnds_last_sync_at,
    EXISTS(SELECT 1 FROM rnds_certificates c WHERE c.tenant_id = t.id AND c.is_active = TRUE) AS has_certificate,
    (SELECT c.valid_to FROM rnds_certificates c WHERE c.tenant_id = t.id AND c.is_active = TRUE ORDER BY c.valid_to DESC LIMIT 1) AS certificate_valid_to
  FROM tenants t
  WHERE t.id = v_tenant_id;
END;
$$;


-- ============================================
-- Function: update_tenant_rnds_config
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_tenant_rnds_config(
  p_rnds_enabled BOOLEAN DEFAULT NULL,
  p_rnds_cnes VARCHAR DEFAULT NULL,
  p_rnds_uf VARCHAR DEFAULT NULL,
  p_rnds_environment VARCHAR DEFAULT NULL,
  p_rnds_auto_send BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  UPDATE tenants SET
    rnds_enabled = COALESCE(p_rnds_enabled, rnds_enabled),
    rnds_cnes = COALESCE(p_rnds_cnes, rnds_cnes),
    rnds_uf = COALESCE(p_rnds_uf, rnds_uf),
    rnds_environment = COALESCE(p_rnds_environment, rnds_environment),
    rnds_auto_send = COALESCE(p_rnds_auto_send, rnds_auto_send),
    updated_at = NOW()
  WHERE id = v_tenant_id;
  
  RETURN TRUE;
END;
$$;


-- ============================================
-- Function: create_rnds_submission
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION create_rnds_submission(
  p_resource_type rnds_resource_type,
  p_resource_id UUID,
  p_fhir_bundle JSONB,
  p_patient_id UUID DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_medical_record_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_submission_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  INSERT INTO rnds_submissions (
    tenant_id,
    resource_type,
    resource_id,
    fhir_bundle,
    patient_id,
    appointment_id,
    medical_record_id,
    created_by
  ) VALUES (
    v_tenant_id,
    p_resource_type,
    p_resource_id,
    p_fhir_bundle,
    p_patient_id,
    p_appointment_id,
    p_medical_record_id,
    auth.uid()
  )
  RETURNING id INTO v_submission_id;
  
  RETURN v_submission_id;
END;
$$;


-- ============================================
-- Function: get_pending_rnds_submissions
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_pending_rnds_submissions(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  resource_type rnds_resource_type,
  resource_id UUID,
  fhir_bundle JSONB,
  attempt_count INTEGER,
  scheduled_at TIMESTAMPTZ,
  rnds_cnes VARCHAR,
  rnds_uf VARCHAR,
  rnds_environment VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.tenant_id,
    s.resource_type,
    s.resource_id,
    s.fhir_bundle,
    s.attempt_count,
    s.scheduled_at,
    t.rnds_cnes,
    t.rnds_uf,
    t.rnds_environment
  FROM rnds_submissions s
  JOIN tenants t ON t.id = s.tenant_id
  WHERE s.status IN ('pending', 'retry')
    AND s.scheduled_at <= NOW()
    AND (s.next_retry_at IS NULL OR s.next_retry_at <= NOW())
    AND s.attempt_count < s.max_attempts
    AND t.rnds_enabled = TRUE
  ORDER BY s.scheduled_at ASC
  LIMIT p_limit;
END;
$$;


-- ============================================
-- Function: update_rnds_submission_status
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_rnds_submission_status(
  p_submission_id UUID,
  p_status rnds_submission_status,
  p_rnds_protocol VARCHAR DEFAULT NULL,
  p_rnds_response JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_code VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_retry TIMESTAMPTZ;
  v_attempt INTEGER;
BEGIN
  SELECT attempt_count INTO v_attempt FROM rnds_submissions WHERE id = p_submission_id;
  
  IF p_status = 'retry' THEN
    v_next_retry := NOW() + (POWER(2, v_attempt) * INTERVAL '1 minute');
  END IF;
  
  UPDATE rnds_submissions SET
    status = p_status,
    rnds_protocol = COALESCE(p_rnds_protocol, rnds_protocol),
    rnds_response = COALESCE(p_rnds_response, rnds_response),
    error_message = p_error_message,
    error_code = p_error_code,
    attempt_count = attempt_count + 1,
    processed_at = CASE WHEN p_status IN ('success', 'error') THEN NOW() ELSE processed_at END,
    next_retry_at = v_next_retry,
    updated_at = NOW()
  WHERE id = p_submission_id;
  
  IF p_status = 'success' THEN
    UPDATE tenants SET rnds_last_sync_at = NOW()
    WHERE id = (SELECT tenant_id FROM rnds_submissions WHERE id = p_submission_id);
  END IF;
  
  RETURN TRUE;
END;
$$;


-- ============================================
-- Function: get_rnds_statistics
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_rnds_statistics()
RETURNS TABLE (
  total_submissions BIGINT,
  pending_count BIGINT,
  success_count BIGINT,
  error_count BIGINT,
  retry_count BIGINT,
  success_rate NUMERIC,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_submissions,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_count,
    COUNT(*) FILTER (WHERE status = 'success')::BIGINT AS success_count,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT AS error_count,
    COUNT(*) FILTER (WHERE status = 'retry')::BIGINT AS retry_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status IN ('success', 'error')) > 0 
      THEN ROUND(
        COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / 
        COUNT(*) FILTER (WHERE status IN ('success', 'error'))::NUMERIC * 100, 2
      )
      ELSE 0
    END AS success_rate,
    MAX(processed_at) FILTER (WHERE status = 'success') AS last_success_at,
    MAX(processed_at) FILTER (WHERE status = 'error') AS last_error_at
  FROM rnds_submissions
  WHERE tenant_id = v_tenant_id;
END;
$$;


-- ============================================
-- Function: auto_submit_to_rnds
-- Source: 20260329100000_rnds_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION auto_submit_to_rnds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_record RECORD;
  v_patient RECORD;
  v_professional RECORD;
  v_fhir_bundle JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO v_tenant_record FROM tenants WHERE id = NEW.tenant_id;
    
    IF v_tenant_record.rnds_enabled = TRUE AND v_tenant_record.rnds_auto_send = TRUE THEN
      SELECT * INTO v_patient FROM clients WHERE id = NEW.client_id;
      SELECT * INTO v_professional FROM profiles WHERE id = NEW.professional_id;
      
      IF v_patient.cns IS NOT NULL OR v_patient.cpf IS NOT NULL THEN
        v_fhir_bundle := jsonb_build_object(
          'resourceType', 'Bundle',
          'type', 'transaction',
          'timestamp', NOW(),
          'appointment_id', NEW.id,
          'patient', jsonb_build_object(
            'id', v_patient.id,
            'name', v_patient.name,
            'cpf', v_patient.cpf,
            'cns', v_patient.cns,
            'birth_date', v_patient.birth_date,
            'gender', v_patient.gender
          ),
          'encounter', jsonb_build_object(
            'date', NEW.date,
            'type', NEW.service_type,
            'professional_name', v_professional.full_name,
            'professional_crm', v_professional.crm,
            'professional_cbo', v_professional.cbo,
            'cnes', v_tenant_record.rnds_cnes
          )
        );
        
        INSERT INTO rnds_submissions (
          tenant_id,
          resource_type,
          resource_id,
          fhir_bundle,
          patient_id,
          appointment_id,
          status
        ) VALUES (
          NEW.tenant_id,
          'contato_assistencial',
          NEW.id,
          v_fhir_bundle,
          NEW.client_id,
          NEW.id,
          'pending'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: process_hl7_lab_result
-- Source: 20260329300000_hl7_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION process_hl7_lab_result(
    p_tenant_id UUID,
    p_connection_id UUID,
    p_raw_message TEXT,
    p_parsed_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
                WHEN v_client_id IS NULL THEN 'Paciente não encontrado no sistema'
                ELSE 'Nenhum resultado na mensagem'
            END,
            processed_at = NOW()
        WHERE id = v_log_id;
    END IF;
    
    RETURN v_log_id;
END;
$$;


-- ============================================
-- Function: get_hl7_dashboard_stats
-- Source: 20260329300000_hl7_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_hl7_dashboard_stats(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_messages', (
            SELECT COUNT(*) FROM hl7_message_log 
            WHERE tenant_id = p_tenant_id 
            AND received_at >= NOW() - (p_days || ' days')::interval
        ),
        'processed', (
            SELECT COUNT(*) FROM hl7_message_log 
            WHERE tenant_id = p_tenant_id 
            AND status = 'processed'
            AND received_at >= NOW() - (p_days || ' days')::interval
        ),
        'failed', (
            SELECT COUNT(*) FROM hl7_message_log 
            WHERE tenant_id = p_tenant_id 
            AND status = 'failed'
            AND received_at >= NOW() - (p_days || ' days')::interval
        ),
        'pending_review', (
            SELECT COUNT(*) FROM hl7_message_log 
            WHERE tenant_id = p_tenant_id 
            AND status = 'failed'
            AND patient_id IS NULL
        ),
        'by_type', (
            SELECT COALESCE(json_agg(json_build_object(
                'type', message_type,
                'count', cnt
            )), '[]'::json)
            FROM (
                SELECT message_type, COUNT(*) as cnt
                FROM hl7_message_log
                WHERE tenant_id = p_tenant_id
                AND received_at >= NOW() - (p_days || ' days')::interval
                GROUP BY message_type
                ORDER BY cnt DESC
            ) t
        ),
        'by_day', (
            SELECT COALESCE(json_agg(json_build_object(
                'date', day,
                'inbound', inbound,
                'outbound', outbound
            ) ORDER BY day), '[]'::json)
            FROM (
                SELECT 
                    DATE(received_at) as day,
                    COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
                    COUNT(*) FILTER (WHERE direction = 'outbound') as outbound
                FROM hl7_message_log
                WHERE tenant_id = p_tenant_id
                AND received_at >= NOW() - (p_days || ' days')::interval
                GROUP BY DATE(received_at)
            ) t
        ),
        'active_connections', (
            SELECT COUNT(*) FROM hl7_connections
            WHERE tenant_id = p_tenant_id AND is_active = TRUE
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


-- ============================================
-- Function: update_hl7_updated_at
-- Source: 20260329300000_hl7_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_hl7_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

