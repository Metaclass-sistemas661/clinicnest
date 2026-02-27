-- Migration: HL7 Integration Tables
-- Fase 38 - Integração Hospitalar HL7
-- Created: 2026-02-25

-- ============================================================================
-- HL7 CONNECTIONS TABLE
-- Stores HL7 connection configurations per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Connection type
    connection_type TEXT NOT NULL CHECK (connection_type IN ('inbound', 'outbound', 'bidirectional')),
    
    -- For outbound connections (sending to labs)
    remote_host TEXT,
    remote_port INTEGER CHECK (remote_port > 0 AND remote_port < 65536),
    
    -- For inbound connections (receiving from labs)
    webhook_url TEXT,
    webhook_secret TEXT,
    
    -- Message types supported
    supported_message_types TEXT[] DEFAULT ARRAY['ORU^R01', 'ORM^O01', 'ACK'],
    
    -- HL7 version
    hl7_version TEXT DEFAULT '2.5' CHECK (hl7_version IN ('2.3', '2.3.1', '2.4', '2.5', '2.5.1')),
    
    -- Identification
    sending_application TEXT DEFAULT 'CLINICAFLOW',
    sending_facility TEXT,
    receiving_application TEXT,
    receiving_facility TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    UNIQUE(tenant_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hl7_connections_tenant ON hl7_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hl7_connections_active ON hl7_connections(tenant_id, is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE hl7_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant HL7 connections"
    ON hl7_connections FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage HL7 connections"
    ON hl7_connections FOR ALL
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.is_tenant_admin(auth.uid(), tenant_id)
    )
    WITH CHECK (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.is_tenant_admin(auth.uid(), tenant_id)
    );


-- ============================================================================
-- HL7 FIELD MAPPINGS TABLE
-- Custom field mappings for each connection
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES hl7_connections(id) ON DELETE CASCADE,
    
    -- Source (HL7)
    segment_name TEXT NOT NULL,
    field_index INTEGER NOT NULL,
    component_index INTEGER DEFAULT 0,
    
    -- Target (ClinicaFlow)
    target_table TEXT NOT NULL,
    target_column TEXT NOT NULL,
    
    -- Transformation
    transform_function TEXT, -- e.g., 'uppercase', 'date_format', 'lookup'
    transform_params JSONB DEFAULT '{}',
    
    -- Validation
    is_required BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hl7_field_mappings_connection ON hl7_field_mappings(connection_id);

-- RLS
ALTER TABLE hl7_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant field mappings"
    ON hl7_field_mappings FOR SELECT
    USING (
        connection_id IN (
            SELECT id FROM hl7_connections 
            WHERE tenant_id = public.get_user_tenant_id(auth.uid())
        )
    );

CREATE POLICY "Admins can manage field mappings"
    ON hl7_field_mappings FOR ALL
    USING (
        connection_id IN (
            SELECT id FROM hl7_connections 
            WHERE tenant_id = public.get_user_tenant_id(auth.uid())
            AND public.is_tenant_admin(auth.uid(), tenant_id)
        )
    );


-- ============================================================================
-- HL7 MESSAGE LOG TABLE
-- Logs all HL7 messages sent/received
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES hl7_connections(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Message info
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL,
    message_control_id TEXT,
    
    -- Content
    raw_message TEXT NOT NULL,
    parsed_data JSONB,
    
    -- Processing
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'acknowledged')),
    error_message TEXT,
    
    -- ACK info
    ack_code TEXT CHECK (ack_code IN ('AA', 'AE', 'AR')),
    ack_message TEXT,
    
    -- Linked records
    patient_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    exam_result_id UUID REFERENCES exam_results(id) ON DELETE SET NULL,
    
    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    
    -- Retry info
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_tenant ON hl7_message_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_connection ON hl7_message_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_status ON hl7_message_log(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_received ON hl7_message_log(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_patient ON hl7_message_log(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_retry ON hl7_message_log(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- RLS
ALTER TABLE hl7_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant HL7 logs"
    ON hl7_message_log FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "System can insert HL7 logs"
    ON hl7_message_log FOR INSERT
    WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "System can update HL7 logs"
    ON hl7_message_log FOR UPDATE
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ============================================================================
-- HL7 PATIENT MAPPING TABLE
-- Maps external patient IDs to internal client IDs
-- ============================================================================

CREATE TABLE IF NOT EXISTS hl7_patient_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES hl7_connections(id) ON DELETE SET NULL,
    
    -- External ID (from lab/hospital)
    external_patient_id TEXT NOT NULL,
    external_system TEXT, -- e.g., 'LAB_XYZ', 'HOSPITAL_ABC'
    
    -- Internal ID
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Matching info
    matched_by TEXT, -- 'cpf', 'name_dob', 'manual', 'auto'
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Status
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, external_patient_id, external_system)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hl7_patient_mapping_tenant ON hl7_patient_mapping(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hl7_patient_mapping_external ON hl7_patient_mapping(external_patient_id, external_system);
CREATE INDEX IF NOT EXISTS idx_hl7_patient_mapping_client ON hl7_patient_mapping(client_id);

-- RLS
ALTER TABLE hl7_patient_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant patient mappings"
    ON hl7_patient_mapping FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can manage patient mappings"
    ON hl7_patient_mapping FOR ALL
    USING (tenant_id = public.get_user_tenant_id(auth.uid()))
    WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ============================================================================
-- FUNCTION: Process HL7 Lab Result
-- Parses HL7 message and creates exam_result record
-- ============================================================================

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


-- ============================================================================
-- FUNCTION: Get HL7 Dashboard Stats
-- Returns statistics for HL7 integration dashboard
-- ============================================================================

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


-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_hl7_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hl7_connections_updated_at
    BEFORE UPDATE ON hl7_connections
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();

CREATE TRIGGER trigger_hl7_patient_mapping_updated_at
    BEFORE UPDATE ON hl7_patient_mapping
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();


-- ============================================================================
-- Add source column to exam_results if not exists
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exam_results' AND column_name = 'source'
    ) THEN
        ALTER TABLE exam_results ADD COLUMN source TEXT DEFAULT 'manual';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exam_results' AND column_name = 'result_data'
    ) THEN
        ALTER TABLE exam_results ADD COLUMN result_data JSONB;
    END IF;
END $$;


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE hl7_connections IS 'HL7 connection configurations for labs and hospitals';
COMMENT ON TABLE hl7_field_mappings IS 'Custom field mappings for HL7 message parsing';
COMMENT ON TABLE hl7_message_log IS 'Log of all HL7 messages sent and received';
COMMENT ON TABLE hl7_patient_mapping IS 'Maps external patient IDs to internal client IDs';
COMMENT ON FUNCTION process_hl7_lab_result IS 'Processes incoming HL7 lab results and creates exam records';
COMMENT ON FUNCTION get_hl7_dashboard_stats IS 'Returns statistics for HL7 integration dashboard';
