-- ============================================================================
-- FIX: Adicionar GRANTs faltantes para TODAS as funções de fila
-- ============================================================================
-- CAUSA RAIZ: O Supabase revoga EXECUTE de funções por padrão
--   (ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC)
--
-- Consequência: O trigger funciona (SECURITY DEFINER → roda como postgres),
--   mas as chamadas RPC do frontend (authenticated) falham silenciosamente.
--   → get_waiting_queue retorna vazio → dashboard mostra 0 Na Fila
--   → get_queue_statistics retorna null → todos os contadores ficam 0
--   → add_patient_to_queue (fallback) falha → paciente não entra via frontend
--
-- FIX: GRANT EXECUTE TO authenticated em TODAS as funções de fila
-- ============================================================================

-- ─── Funções de leitura da fila ─────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_waiting_queue(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_call(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_queue_statistics(UUID) TO authenticated;

-- ─── Funções de ação na fila ────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.add_patient_to_queue(UUID, UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.call_next_patient(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recall_patient(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_patient_service(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_patient_service(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_patient_no_show(UUID) TO authenticated;

-- ─── Funções auxiliares ─────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.generate_call_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_priority(UUID) TO authenticated;

-- ─── Funções de configuração de fila (da migration auto_queue_on_checkin) ───

DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.get_tenant_queue_settings(UUID) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.update_tenant_queue_settings(UUID, BOOLEAN) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── Também grant para service_role (edge functions, webhooks) ──────────────

GRANT EXECUTE ON FUNCTION public.get_waiting_queue(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_current_call(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_queue_statistics(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_patient_to_queue(UUID, UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.call_next_patient(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recall_patient(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_patient_service(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_patient_service(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_patient_no_show(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_call_number(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_patient_priority(UUID) TO service_role;
