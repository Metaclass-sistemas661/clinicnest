-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (009_ai_automation)
-- 2 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260329200000_ai_integration_v1.sql
CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    feature TEXT NOT NULL CHECK (feature IN ('triage', 'cid_suggest', 'summary', 'transcribe', 'sentiment')),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Source: 20260329200000_ai_integration_v1.sql
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

ALTER TABLE public.feedback_analysis ENABLE ROW LEVEL SECURITY;

