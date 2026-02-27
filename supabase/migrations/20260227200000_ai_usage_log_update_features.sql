-- Migration: Add agent_chat and patient_chat to ai_usage_log feature CHECK constraint
-- Also add composite index for daily usage counting

-- Drop old CHECK constraint and add updated one
ALTER TABLE ai_usage_log DROP CONSTRAINT IF EXISTS ai_usage_log_feature_check;
ALTER TABLE ai_usage_log ADD CONSTRAINT ai_usage_log_feature_check
  CHECK (feature IN ('triage', 'cid_suggest', 'summary', 'transcribe', 'sentiment', 'agent_chat', 'patient_chat'));

-- Composite index for efficient daily usage counting (tenant + date)
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_daily
  ON ai_usage_log(tenant_id, created_at DESC);
