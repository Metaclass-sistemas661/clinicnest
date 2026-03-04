-- ============================================================
-- FIX: Adicionar coluna transfer_phone em chatbot_settings
-- APLICAR no SQL Editor do Supabase (Production)
-- ============================================================

-- 1. Adiciona a coluna transfer_phone (texto livre para número de telefone)
ALTER TABLE public.chatbot_settings
  ADD COLUMN IF NOT EXISTS transfer_phone TEXT;

-- 2. Confirma que as colunas existem
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chatbot_settings'
ORDER BY ordinal_position;
