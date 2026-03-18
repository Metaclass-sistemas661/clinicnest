-- Adiciona coluna autonomous_config (JSONB) na tabela tenants
-- Usada pela página "Clínica Autônoma" para armazenar configurações de automação

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS autonomous_config JSONB DEFAULT '{
    "auto_checkin_enabled": false,
    "auto_triage_enabled": false,
    "auto_prefill_prontuario": false,
    "auto_notify_doctor": false,
    "auto_send_prep_instructions": false,
    "auto_post_consult_summary": false
  }'::jsonb;
