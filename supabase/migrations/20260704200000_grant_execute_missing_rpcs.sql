-- ============================================================================
-- Migration: GRANT EXECUTE para 32 RPCs chamadas pelo frontend sem permissão
-- Data: 2026-07-04
-- Severidade: ALTA — sem GRANT, PostgREST retorna 404 para essas funções
-- ============================================================================

-- === Chat ===
GRANT EXECUTE ON FUNCTION public.create_chat_channel(text, text, boolean, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_chat_message(text, uuid, text, uuid[], jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edit_chat_message(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_chat_message(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_chat_as_read(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unread_chat_count(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_chat_messages(text, text, integer) TO authenticated, service_role;

-- === Retornos / Automação de retorno ===
GRANT EXECUTE ON FUNCTION public.create_return_reminder(uuid, integer, text, boolean, integer, text, boolean, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_returns(uuid, text, date, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_returns_to_notify(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_return_statistics(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_appointment_to_return(uuid, uuid) TO authenticated, service_role;

-- === Retenção CFM ===
GRANT EXECUTE ON FUNCTION public.get_retention_statistics(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_retention_deletion_attempts(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_clients_near_retention_expiry(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_client_clinical_data(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_archived_client_data(uuid, text, text) TO authenticated, service_role;

-- === ONA / Acreditação ===
GRANT EXECUTE ON FUNCTION public.calcular_indicadores_ona(uuid, date, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_adverse_event_number(uuid) TO authenticated, service_role;

-- === Odontologia ===
GRANT EXECUTE ON FUNCTION public.get_client_dental_images(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_periogram_measurements(uuid) TO authenticated, service_role;

-- === HL7/FHIR ===
GRANT EXECUTE ON FUNCTION public.get_hl7_dashboard_stats(uuid, integer) TO authenticated, service_role;

-- === Certificado digital / Assinatura ===
GRANT EXECUTE ON FUNCTION public.sign_medical_certificate(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sign_prescription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_certificate_signature(uuid) TO authenticated, service_role;

-- === Feature overrides (admin) ===
GRANT EXECUTE ON FUNCTION public.create_feature_override(uuid, text, boolean, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_limit_override(uuid, text, integer, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_overrides() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_has_feature(uuid, text) TO authenticated, service_role;

-- === Tema / Personalização ===
GRANT EXECUTE ON FUNCTION public.get_tenant_theme(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_theme(uuid, integer, integer, integer, integer, integer, integer, text, text, text, text, text, text) TO authenticated, service_role;

-- === Agenda / No-show ===
GRANT EXECUTE ON FUNCTION public.get_time_slot_no_show_rate(uuid, integer, integer) TO authenticated, service_role;
