-- ============================================================
-- GCP Cloud SQL Migration - 005_policies_communications.sql
-- Execution Order: 015
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: RLS Policies - communications
-- Total: 10 policies


-- ── Table: chat_channel_members ──
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE POLICY "chat_channel_members_access" ON public.chat_channel_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = channel_id AND c.tenant_id = public.get_my_tenant_id()
    )
  );


-- ── Table: chat_channels ──
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE POLICY "chat_channels_tenant_isolation" ON public.chat_channels
  FOR ALL USING (tenant_id = public.get_my_tenant_id());


-- ── Table: chat_read_status ──
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE POLICY "chat_read_status_own" ON public.chat_read_status
  FOR ALL USING (profile_id = public.get_my_profile_id());


-- ── Table: contact_messages ──
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Source: 20260216132000_rls_audit_fixes_public.sql
create policy "Service role can read contact messages" on public.contact_messages
for select
to public
using (current_setting('app.user_role')::text = 'service_role');


-- ── Table: internal_messages ──
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Source: 20260320120000_internal_chat.sql
CREATE POLICY "messages_select" ON public.internal_messages
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid));

-- Source: 20260320120000_internal_chat.sql
CREATE POLICY "messages_insert" ON public.internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(current_setting('app.current_user_id')::uuid)
    AND sender_id = (SELECT id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid LIMIT 1)
  );

-- Source: 20260320120000_internal_chat.sql
CREATE POLICY "messages_delete" ON public.internal_messages
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(current_setting('app.current_user_id')::uuid, tenant_id));


-- ── Table: message_templates ──
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Source: 20260326200000_patient_portal_messages_v1.sql
CREATE POLICY "message_templates_tenant_all" ON public.message_templates
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = current_setting('app.current_user_id')::uuid));


-- ── Table: push_notifications_log ──
ALTER TABLE public.push_notifications_log ENABLE ROW LEVEL SECURITY;

-- Source: 20260324300000_push_notifications_v1.sql
CREATE POLICY "Tenant isolation for push_log" ON push_notifications_log
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid));


-- ── Table: push_subscriptions ──
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Source: 20260324300000_push_notifications_v1.sql
CREATE POLICY "Usuário gerencia suas subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

