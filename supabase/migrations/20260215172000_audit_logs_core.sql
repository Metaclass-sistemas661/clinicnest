-- Core audit logs (tenant-scoped) for enterprise-grade traceability

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_user_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only tenant admins can read audit logs
DROP POLICY IF EXISTS "Tenant admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Tenant admins can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Inserts are performed via security definer function (and optionally service_role).
-- No direct INSERT policy.

CREATE OR REPLACE FUNCTION public.log_tenant_action(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_actor_role text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Ação de auditoria é obrigatória';
  END IF;

  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'Tipo de entidade é obrigatório';
  END IF;

  -- If called from a client session, ensure the actor belongs to tenant.
  IF auth.uid() IS NOT NULL THEN
    IF p_actor_user_id IS NULL THEN
      p_actor_user_id := auth.uid();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = p_actor_user_id
        AND p.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'Usuário não pertence ao tenant';
    END IF;
  END IF;

  SELECT ur.role::text INTO v_actor_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_actor_user_id
    AND ur.tenant_id = p_tenant_id
  LIMIT 1;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_actor_user_id,
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_tenant_action(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_tenant_action(uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_tenant_action(uuid, uuid, text, text, text, jsonb) TO service_role;

-- Support: automatic audit via triggers
CREATE OR REPLACE FUNCTION public.audit_support_ticket_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_tenant_action(
    NEW.tenant_id,
    NEW.created_by,
    'support_ticket_created',
    'support_ticket',
    NEW.id::text,
    jsonb_build_object(
      'subject', NEW.subject,
      'category', NEW.category,
      'priority', NEW.priority,
      'channel', NEW.channel,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_support_ticket_insert ON public.support_tickets;
CREATE TRIGGER trg_audit_support_ticket_insert
AFTER INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.audit_support_ticket_insert();

CREATE OR REPLACE FUNCTION public.audit_support_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_tenant_action(
    NEW.tenant_id,
    COALESCE(NEW.created_by, auth.uid()),
    'support_message_created',
    'support_message',
    NEW.id::text,
    jsonb_build_object(
      'ticket_id', NEW.ticket_id::text,
      'sender', NEW.sender
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_support_message_insert ON public.support_messages;
CREATE TRIGGER trg_audit_support_message_insert
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.audit_support_message_insert();
