-- ============================================================================
-- DIAGNÓSTICO COMPLETO: Fluxo Check-in → Fila de Espera
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para diagnosticar
-- por que o check-in não adiciona paciente à fila.
-- ============================================================================

-- 1. TRIGGER: Verifica se o trigger existe e está ativo
SELECT 
  tgname AS trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN 'ORIGIN (ativo)'
    WHEN 'D' THEN '⚠️ DESABILITADO'
    WHEN 'R' THEN 'REPLICA ONLY'
    WHEN 'A' THEN 'ALWAYS'
    ELSE tgenabled::TEXT
  END AS status,
  tgtype,
  pg_get_functiondef(tgfoid) IS NOT NULL AS function_exists
FROM pg_trigger 
WHERE tgrelid = 'public.appointments'::regclass
  AND tgname LIKE '%auto_queue%' OR tgname LIKE '%checkin%';

-- 2. VERSÃO DA FUNÇÃO: Verifica qual versão do trigger está ativa
-- Se contém 'BEGIN/EXCEPTION', é a versão robusta (20260628300000)
-- Se contém 'message', é a versão antiga com bug  
-- Se contém 'body', é a versão corrigida (20260628100000)
SELECT 
  proname AS function_name,
  CASE 
    WHEN prosrc LIKE '%EXCEPTION%' THEN '✅ Versão robusta (com exception handling)'
    WHEN prosrc LIKE '%body%' THEN '⚠️ Versão 20260628100000 (sem exception handling)'
    WHEN prosrc LIKE '%message%' THEN '❌ Versão antiga com BUG (usa message/data)'
    ELSE '❓ Versão desconhecida'
  END AS version,
  CASE 
    WHEN prosrc LIKE '%NEW.patient_id%' THEN '✅ Usa patient_id'
    WHEN prosrc LIKE '%NEW.client_id%' THEN '❌ Usa client_id (pode falhar)'
    ELSE '❓ Não detectado'
  END AS column_reference
FROM pg_proc 
WHERE proname = 'auto_add_to_queue_on_checkin';

-- 3. VERSÃO DO add_patient_to_queue: Verifica param names e coluna usada
SELECT 
  proname,
  pg_get_function_arguments(oid) AS arguments,
  CASE 
    WHEN prosrc LIKE '%patient_id%' THEN '✅ Usa patient_id column'
    WHEN prosrc LIKE '%client_id%' THEN '❌ Usa client_id column (pode falhar)'
    ELSE '❓'
  END AS column_used,
  CASE 
    WHEN prosrc LIKE '%clinic_rooms%' THEN '✅ Usa clinic_rooms'
    WHEN prosrc LIKE '%FROM rooms%' THEN '⚠️ Usa rooms (legado)'
    ELSE '❓ Sem room lookup'
  END AS room_table
FROM pg_proc 
WHERE proname = 'add_patient_to_queue';

-- 4. FLAG DO TENANT: Verifica se auto_queue_on_checkin está habilitado
SELECT 
  id AS tenant_id, 
  name,
  auto_queue_on_checkin,
  CASE 
    WHEN auto_queue_on_checkin = true THEN '✅ Auto-queue habilitado'
    WHEN auto_queue_on_checkin = false THEN '❌ Auto-queue DESABILITADO!'
    WHEN auto_queue_on_checkin IS NULL THEN '⚠️ NULL (default true via COALESCE)'
    ELSE '❓'
  END AS status
FROM tenants;

-- 5. COLUNAS DA patient_calls: Verifica se tem patient_id ou client_id
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'patient_calls'
ORDER BY ordinal_position;

-- 6. COLUNAS DA appointments: Verifica se tem patient_id ou client_id
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'appointments'
  AND column_name IN ('client_id', 'patient_id')
ORDER BY column_name;

-- 7. TABELA notifications: Verifica se tem body/metadata ou message/data
SELECT column_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'notifications'
  AND column_name IN ('body', 'metadata', 'message', 'data')
ORDER BY column_name;

-- 8. ENTRADAS NA FILA HOJE: Verifica se há registros em patient_calls
SELECT 
  id, 
  tenant_id,
  patient_id, 
  appointment_id,
  status, 
  call_number, 
  priority,
  checked_in_at,
  created_at
FROM patient_calls 
WHERE created_at::DATE = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 20;

-- 9. APPOINTMENTS COM STATUS 'arrived' HOJE
SELECT 
  a.id,
  a.patient_id,
  a.professional_id,
  a.status,
  a.tenant_id,
  p.name AS patient_name,
  a.scheduled_at
FROM appointments a
LEFT JOIN patients p ON p.id = a.patient_id
WHERE a.status = 'arrived'
  AND a.scheduled_at::DATE = CURRENT_DATE
ORDER BY a.scheduled_at;

-- 10. TABELAS DE ROOMS: Verifica se existem ambas
SELECT 
  'rooms' AS table_name, 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms' AND table_schema = 'public') AS exists
UNION ALL
SELECT 
  'clinic_rooms' AS table_name, 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'clinic_rooms' AND table_schema = 'public') AS exists;

-- 11. HISTÓRICO DE MIGRATIONS APLICADAS (queue-related)
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%queue%' 
   OR name LIKE '%checkin%' 
   OR name LIKE '%patient_call%'
   OR name LIKE '%rename_clients%'
   OR name LIKE '%notification%'
   OR name LIKE '%rooms%'
   OR name LIKE '%robust%'
ORDER BY version;

-- 12. TESTE MANUAL: Verifica se get_patient_priority funciona
-- (substitua o UUID pelo ID de um paciente real)
-- SELECT * FROM get_patient_priority('SEU-PATIENT-UUID-AQUI');

-- 13. LOGS DE WARNING do trigger (se Supabase expor)
-- Os RAISE WARNING do trigger robusto aparecem nos logs do Supabase:
-- Painel → Database → Logs
