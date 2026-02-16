-- Support tickets (in-app support)

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  channel text NOT NULL DEFAULT 'email',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT support_tickets_category_check CHECK (category IN ('general','billing','technical','feature_request','bug','security','lgpd')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open','pending','solved','closed')),
  CONSTRAINT support_tickets_channel_check CHECK (channel IN ('email','whatsapp'))
);

CREATE INDEX IF NOT EXISTS support_tickets_tenant_id_idx ON public.support_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS support_tickets_last_message_at_idx ON public.support_tickets (tenant_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT support_messages_sender_check CHECK (sender IN ('user','support','system'))
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_id_idx ON public.support_messages (ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS support_messages_tenant_id_idx ON public.support_messages (tenant_id, created_at DESC);

-- Keep tenant_id consistent with ticket
CREATE OR REPLACE FUNCTION public.support_messages_enforce_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT t.tenant_id INTO NEW.tenant_id
    FROM public.support_tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = NEW.ticket_id
      AND t.tenant_id <> NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  UPDATE public.support_tickets
    SET last_message_at = now(),
        updated_at = now()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_messages_enforce_tenant ON public.support_messages;
CREATE TRIGGER trg_support_messages_enforce_tenant
BEFORE INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.support_messages_enforce_tenant_id();

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: tenant-scoped read
DROP POLICY IF EXISTS "Users can read support tickets in their tenant" ON public.support_tickets;
CREATE POLICY "Users can read support tickets in their tenant"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
);

-- Tickets: create
DROP POLICY IF EXISTS "Users can create support tickets in their tenant" ON public.support_tickets;
CREATE POLICY "Users can create support tickets in their tenant"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
  AND created_by = auth.uid()
);

-- Tickets: update only admins (status/priority)
DROP POLICY IF EXISTS "Admins can update support tickets in their tenant" ON public.support_tickets;
CREATE POLICY "Admins can update support tickets in their tenant"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  AND public.tenant_has_access(tenant_id)
);

-- Messages: tenant-scoped read
DROP POLICY IF EXISTS "Users can read support messages in their tenant" ON public.support_messages;
CREATE POLICY "Users can read support messages in their tenant"
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
);

-- Messages: create by any authenticated user in tenant
DROP POLICY IF EXISTS "Users can create support messages in their tenant" ON public.support_messages;
CREATE POLICY "Users can create support messages in their tenant"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.tenant_has_access(tenant_id)
  AND (created_by IS NULL OR created_by = auth.uid())
);
