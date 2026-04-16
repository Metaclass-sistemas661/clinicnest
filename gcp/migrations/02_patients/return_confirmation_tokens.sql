-- Table: return_confirmation_tokens
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.return_confirmation_tokens (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  return_id UUID NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.return_confirmation_tokens ADD CONSTRAINT return_confirmation_tokens_token_key UNIQUE (token);

ALTER TABLE public.return_confirmation_tokens ADD CONSTRAINT return_confirmation_tokens_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.return_confirmation_tokens ADD CONSTRAINT return_confirmation_tokens_return_id_fkey
  FOREIGN KEY (return_id) REFERENCES public.return_reminders(id);

ALTER TABLE public.return_confirmation_tokens ADD CONSTRAINT return_confirmation_tokens_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
