-- Patient Access Code v1
-- Adds access_code + user_id to clients table.
-- Patients identify themselves by access_code or CPF to activate their portal account.

-- ─── 1. Add columns ──────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS access_code TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 2. Function to generate unique access code ──────────────
CREATE OR REPLACE FUNCTION public.generate_client_access_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.access_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  LOOP
    -- Generate PAC-XXXXXX (6 alphanumeric uppercase chars)
    v_code := 'PAC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    SELECT EXISTS(SELECT 1 FROM public.clients WHERE access_code = v_code) INTO v_exists;

    IF NOT v_exists THEN
      NEW.access_code := v_code;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ─── 3. Trigger to auto-generate on insert ───────────────────
DROP TRIGGER IF EXISTS trg_generate_client_access_code ON public.clients;
CREATE TRIGGER trg_generate_client_access_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_access_code();

-- ─── 4. Backfill existing clients that have no access_code ───
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM public.clients WHERE access_code IS NULL
  LOOP
    LOOP
      v_code := 'PAC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      SELECT EXISTS(SELECT 1 FROM public.clients WHERE access_code = v_code) INTO v_exists;
      IF NOT v_exists THEN
        UPDATE public.clients SET access_code = v_code WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ─── 5. Make access_code unique and indexed ──────────────────
ALTER TABLE public.clients
  ALTER COLUMN access_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_access_code ON public.clients(access_code);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- ─── 6. RPC: validate_patient_access ─────────────────────────
-- Called from the patient login page (anonymous).
-- Accepts an access_code or CPF, returns patient status.
-- Does NOT require authentication.
CREATE OR REPLACE FUNCTION public.validate_patient_access(
  p_identifier TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_identifier TEXT := btrim(upper(p_identifier));
  v_cpf_clean TEXT;
  v_status TEXT;
BEGIN
  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Identificador não informado');
  END IF;

  -- Try by access_code first
  SELECT c.id, c.name, c.email, c.phone, c.tenant_id, c.user_id, c.access_code, c.cpf,
         t.name AS clinic_name
  INTO v_client
  FROM public.clients c
  LEFT JOIN public.tenants t ON t.id = c.tenant_id
  WHERE upper(c.access_code) = v_identifier
  LIMIT 1;

  -- If not found, try by CPF (digits only)
  IF v_client IS NULL THEN
    v_cpf_clean := regexp_replace(p_identifier, '[^0-9]', '', 'g');
    IF length(v_cpf_clean) >= 11 THEN
      SELECT c.id, c.name, c.email, c.phone, c.tenant_id, c.user_id, c.access_code, c.cpf,
             t.name AS clinic_name
      INTO v_client
      FROM public.clients c
      LEFT JOIN public.tenants t ON t.id = c.tenant_id
      WHERE regexp_replace(c.cpf, '[^0-9]', '', 'g') = v_cpf_clean
      LIMIT 1;
    END IF;
  END IF;

  IF v_client IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Determine status
  IF v_client.user_id IS NOT NULL THEN
    v_status := 'has_account';  -- already activated, go to password login
  ELSE
    v_status := 'new';  -- first access, needs to create password
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_status,
    'client_id', v_client.id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'clinic_name', v_client.clinic_name,
    'masked_email', CASE
      WHEN v_client.email IS NOT NULL AND v_client.email <> '' THEN
        substr(v_client.email, 1, 2) || '***@' || split_part(v_client.email, '@', 2)
      ELSE NULL
    END
  );
END;
$$;

-- Grant to anon so unauthenticated patients can call it
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO authenticated;

-- ─── 7. RPC: activate_patient_account ────────────────────────
-- Called by the Edge Function (service_role) to link a newly created
-- auth user to the client record and create patient_profiles entry.
CREATE OR REPLACE FUNCTION public.activate_patient_account(
  p_client_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_pp_id UUID;
BEGIN
  -- Validate client exists and has no user_id yet
  SELECT id, tenant_id, name, user_id
  INTO v_client
  FROM public.clients
  WHERE id = p_client_id;

  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLIENT_NOT_FOUND');
  END IF;

  IF v_client.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ACTIVATED');
  END IF;

  -- Link user to client
  UPDATE public.clients
  SET user_id = p_user_id, updated_at = now()
  WHERE id = p_client_id;

  -- Create patient_profiles entry (upsert to avoid conflicts)
  INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
  VALUES (p_user_id, v_client.tenant_id, p_client_id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, is_active = true, updated_at = now()
  RETURNING id INTO v_pp_id;

  RETURN jsonb_build_object(
    'success', true,
    'patient_profile_id', v_pp_id,
    'client_name', v_client.name
  );
END;
$$;

-- Only service_role should call this (from Edge Function)
REVOKE ALL ON FUNCTION public.activate_patient_account(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.activate_patient_account(UUID, UUID) TO service_role;

-- ─── 8. Update upsert_client_v2 to return access_code ───────
CREATE OR REPLACE FUNCTION public.upsert_client_v2(
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_access_code text;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome é obrigatório');
  END IF;

  IF p_client_id IS NULL THEN
    v_action := 'client_created';
    INSERT INTO public.clients(tenant_id, name, phone, email, notes)
    VALUES (v_profile.tenant_id, p_name, NULLIF(p_phone,''), NULLIF(p_email,''), NULLIF(p_notes,''))
    RETURNING id, access_code INTO v_id, v_access_code;
  ELSE
    v_action := 'client_updated';
    UPDATE public.clients
    SET name = p_name,
        phone = NULLIF(p_phone,''),
        email = NULLIF(p_email,''),
        notes = NULLIF(p_notes,''),
        updated_at = now()
    WHERE id = p_client_id
      AND tenant_id = v_profile.tenant_id
    RETURNING id, access_code INTO v_id, v_access_code;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Cliente não encontrado');
    END IF;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    v_action,
    'client',
    v_id::text,
    jsonb_build_object('name', p_name)
  );

  RETURN jsonb_build_object('success', true, 'client_id', v_id, 'access_code', v_access_code);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid) TO service_role;
