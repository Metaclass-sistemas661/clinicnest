-- ============================================================
-- AI Conversations & Messages — memória para agente e chat IA
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('professional', 'patient')),
  title         TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         TEXT NOT NULL,
  tool_name       TEXT,
  tool_input      JSONB,
  tokens_used     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_ai_conv_user       ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX idx_ai_conv_tenant     ON ai_conversations(tenant_id);
CREATE INDEX idx_ai_conv_msgs_conv  ON ai_conversation_messages(conversation_id, created_at);

-- RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conversations"
  ON ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own conversation messages"
  ON ai_conversation_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ai_conversations
    WHERE id = conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users insert own conversation messages"
  ON ai_conversation_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM ai_conversations
    WHERE id = conversation_id AND user_id = auth.uid()
  ));
