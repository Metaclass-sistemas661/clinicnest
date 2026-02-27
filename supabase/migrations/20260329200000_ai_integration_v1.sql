-- Migration: AI Integration Tables
-- Fase 37 - Inteligência Artificial
-- Created: 2026-02-25
-- Fixed: Using correct table names and functions

-- ============================================================================
-- TRANSCRIPTION JOBS TABLE
-- Stores audio transcription job references
-- ============================================================================

CREATE TABLE IF NOT EXISTS transcription_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL UNIQUE,
    s3_uri TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    transcript TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_tenant ON transcription_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user ON transcription_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status ON transcription_jobs(status);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_created ON transcription_jobs(created_at DESC);

-- RLS
ALTER TABLE transcription_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant transcription jobs"
    ON transcription_jobs FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert transcription jobs for own tenant"
    ON transcription_jobs FOR INSERT
    WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant transcription jobs"
    ON transcription_jobs FOR UPDATE
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ============================================================================
-- FEEDBACK ANALYSIS TABLE
-- Stores AI sentiment analysis results for patient feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sentiment TEXT NOT NULL CHECK (sentiment IN ('positivo', 'neutro', 'negativo')),
    score DECIMAL(3,2) NOT NULL CHECK (score >= -1 AND score <= 1),
    aspects JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    action_required BOOLEAN DEFAULT FALSE,
    suggested_action TEXT,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_tenant ON feedback_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment ON feedback_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_action ON feedback_analysis(action_required) WHERE action_required = TRUE;
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_score ON feedback_analysis(score);

-- RLS
ALTER TABLE feedback_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant feedback analysis"
    ON feedback_analysis FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert feedback analysis for own tenant"
    ON feedback_analysis FOR INSERT
    WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ============================================================================
-- AI USAGE LOG TABLE
-- Tracks AI feature usage for billing and monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL CHECK (feature IN ('triage', 'cid_suggest', 'summary', 'transcribe', 'sentiment')),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_log(created_at DESC);

-- RLS
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view tenant AI usage"
    ON ai_usage_log FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.is_tenant_admin(auth.uid(), tenant_id)
    );

CREATE POLICY "System can insert AI usage logs"
    ON ai_usage_log FOR INSERT
    WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ============================================================================
-- FUNCTION: Get time slot no-show rate
-- Used by no-show prediction model
-- ============================================================================

CREATE OR REPLACE FUNCTION get_time_slot_no_show_rate(
    p_tenant_id UUID,
    p_day_of_week INTEGER,
    p_hour INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
    v_total INTEGER;
    v_no_shows INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'no_show')
    INTO v_total, v_no_shows
    FROM appointments
    WHERE tenant_id = p_tenant_id
      AND EXTRACT(DOW FROM scheduled_at) = p_day_of_week
      AND EXTRACT(HOUR FROM scheduled_at) = p_hour
      AND scheduled_at >= NOW() - INTERVAL '90 days';
    
    IF v_total < 10 THEN
        RETURN 0.10; -- Default 10% if not enough data
    END IF;
    
    RETURN v_no_shows::DECIMAL / v_total::DECIMAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- FUNCTION: Get AI usage summary for tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION get_ai_usage_summary(
    p_tenant_id UUID,
    p_start_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    feature TEXT,
    total_calls BIGINT,
    total_input_tokens BIGINT,
    total_output_tokens BIGINT,
    total_cost_usd DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.feature,
        COUNT(*)::BIGINT as total_calls,
        COALESCE(SUM(al.input_tokens), 0)::BIGINT as total_input_tokens,
        COALESCE(SUM(al.output_tokens), 0)::BIGINT as total_output_tokens,
        COALESCE(SUM(al.cost_usd), 0)::DECIMAL as total_cost_usd
    FROM ai_usage_log al
    WHERE al.tenant_id = p_tenant_id
      AND al.created_at >= p_start_date
      AND al.created_at < p_end_date + INTERVAL '1 day'
    GROUP BY al.feature
    ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE transcription_jobs IS 'Stores Amazon Transcribe Medical job references and results';
COMMENT ON TABLE feedback_analysis IS 'Stores AI sentiment analysis results for patient feedback';
COMMENT ON TABLE ai_usage_log IS 'Tracks AI feature usage for billing and monitoring';
COMMENT ON FUNCTION get_time_slot_no_show_rate IS 'Returns historical no-show rate for a specific day/hour combination';
COMMENT ON FUNCTION get_ai_usage_summary IS 'Returns aggregated AI usage statistics for a tenant';
