-- ============================================================================
-- MILESTONE 3: Agenda avançada (Disponibilidade + Bloqueios) — MVP
-- - Jornada por profissional (por dia da semana)
-- - Bloqueios por profissional e bloqueios globais do salão
-- - Validação no create_appointment_v2 / update_appointment_v2
-- ============================================================================

-- ─── 1. TABLES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.professional_working_hours (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week     smallint NOT NULL, -- 0=Sunday..6=Saturday
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pwh_dow_range CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT pwh_time_range CHECK (end_time > start_time),
  CONSTRAINT pwh_unique_per_day UNIQUE (tenant_id, professional_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_pwh_tenant_prof
  ON public.professional_working_hours(tenant_id, professional_id);

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  reason          text NULL,
  created_by      uuid NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sb_time_range CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_sb_tenant_range
  ON public.schedule_blocks(tenant_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_sb_prof_range
  ON public.schedule_blocks(professional_id, start_at, end_at);

-- ─── 2. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.professional_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_working_hours FORCE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pwh_tenant_read" ON public.professional_working_hours;
CREATE POLICY "pwh_tenant_read" ON public.professional_working_hours
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "sb_tenant_read" ON public.schedule_blocks;
CREATE POLICY "sb_tenant_read" ON public.schedule_blocks
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- write via RPC/security definer (service_role allowed)
DROP POLICY IF EXISTS "pwh_service_write" ON public.professional_working_hours;
CREATE POLICY "pwh_service_write" ON public.professional_working_hours
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sb_service_write" ON public.schedule_blocks;
CREATE POLICY "sb_service_write" ON public.schedule_blocks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 3. RPCs ────────────────────────────────────────────────────────────────

-- 3a. Upsert working hours
CREATE OR REPLACE FUNCTION public.upsert_professional_working_hours_v1(
  p_professional_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  -- Staff can only edit own schedule
  IF NOT v_is_admin AND p_professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para editar disponibilidade de outro profissional' USING DETAIL = 'FORBIDDEN';
  END IF;

  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'Dia da semana inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'Intervalo de horário inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.professional_working_hours (
    tenant_id, professional_id, day_of_week, start_time, end_time, is_active
  ) VALUES (
    v_profile.tenant_id, p_professional_id, p_day_of_week, p_start_time, p_end_time, COALESCE(p_is_active, true)
  )
  ON CONFLICT (tenant_id, professional_id, day_of_week)
  DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'professional_working_hours_upserted',
    'professional_working_hours',
    v_id::text,
    jsonb_build_object(
      'professional_id', p_professional_id,
      'day_of_week', p_day_of_week,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'is_active', COALESCE(p_is_active, true)
    )
  );

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_professional_working_hours_v1(uuid, smallint, time, time, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_professional_working_hours_v1(uuid, smallint, time, time, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_professional_working_hours_v1(uuid, smallint, time, time, boolean) TO service_role;

-- 3b. Create schedule block (global or professional)
CREATE OR REPLACE FUNCTION public.create_schedule_block_v1(
  p_professional_id uuid DEFAULT NULL,
  p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  -- Staff can only create blocks for themselves
  IF NOT v_is_admin AND p_professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para criar bloqueio para outro profissional' USING DETAIL = 'FORBIDDEN';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Período inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_professional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.schedule_blocks (
    tenant_id, professional_id, start_at, end_at, reason, created_by
  ) VALUES (
    v_profile.tenant_id, p_professional_id, p_start_at, p_end_at, NULLIF(p_reason, ''), v_user_id
  )
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'schedule_block_created',
    'schedule_block',
    v_id::text,
    jsonb_build_object(
      'professional_id', p_professional_id,
      'start_at', p_start_at,
      'end_at', p_end_at,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'block_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_schedule_block_v1(uuid, timestamptz, timestamptz, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_schedule_block_v1(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_schedule_block_v1(uuid, timestamptz, timestamptz, text) TO service_role;

-- 3c. Delete schedule block
CREATE OR REPLACE FUNCTION public.delete_schedule_block_v1(
  p_block_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_block public.schedule_blocks%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  SELECT * INTO v_block
  FROM public.schedule_blocks
  WHERE id = p_block_id AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bloqueio não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  IF NOT v_is_admin AND v_block.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para remover este bloqueio' USING DETAIL = 'FORBIDDEN';
  END IF;

  DELETE FROM public.schedule_blocks WHERE id = p_block_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'schedule_block_deleted',
    'schedule_block',
    p_block_id::text,
    jsonb_build_object('professional_id', v_block.professional_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_schedule_block_v1(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_schedule_block_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_schedule_block_v1(uuid) TO service_role;

-- ─── 4. Helper: check if a slot is allowed by working hours (if configured) ──

CREATE OR REPLACE FUNCTION public.is_slot_within_working_hours_v1(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow smallint;
  v_has_config boolean;
  v_row record;
  v_start_local time;
  v_end_local time;
BEGIN
  v_dow := EXTRACT(DOW FROM p_start_at)::smallint;

  SELECT EXISTS(
    SELECT 1 FROM public.professional_working_hours
    WHERE tenant_id = p_tenant_id
      AND professional_id = p_professional_id
      AND is_active = true
  ) INTO v_has_config;

  -- If no config exists, allow (backward compatible default)
  IF NOT v_has_config THEN
    RETURN true;
  END IF;

  SELECT start_time, end_time
  INTO v_row
  FROM public.professional_working_hours
  WHERE tenant_id = p_tenant_id
    AND professional_id = p_professional_id
    AND day_of_week = v_dow
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_start_local := (p_start_at AT TIME ZONE 'America/Sao_Paulo')::time;
  v_end_local := (p_end_at AT TIME ZONE 'America/Sao_Paulo')::time;

  RETURN (v_start_local >= v_row.start_time) AND (v_end_local <= v_row.end_time);
END;
$$;

REVOKE ALL ON FUNCTION public.is_slot_within_working_hours_v1(uuid, uuid, timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.is_slot_within_working_hours_v1(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_slot_within_working_hours_v1(uuid, uuid, timestamptz, timestamptz) TO service_role;

-- ─── 5. Patch create_appointment_v2 / update_appointment_v2 to enforce blocks/hours ──
-- We re-create the functions with the same signatures and add checks.

-- NOTE: These functions must exist from previous migrations.

CREATE OR REPLACE FUNCTION public.create_appointment_v2(
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_status public.appointment_status DEFAULT 'pending',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_professional_id uuid;
  v_duration integer;
  v_price numeric;
  v_end_at timestamptz;
  v_appointment_id uuid;
  v_lock_key text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at é obrigatório' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  v_duration := COALESCE(p_duration_minutes, 30);
  IF v_duration <= 0 OR v_duration > 24*60 THEN
    RAISE EXCEPTION 'duration_minutes inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  v_price := COALESCE(p_price, 0);
  IF v_price < 0 THEN
    RAISE EXCEPTION 'price não pode ser negativo' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_status IS NULL THEN
    p_status := 'pending';
  END IF;

  IF p_status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Status inicial inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_is_admin THEN
    v_professional_id := COALESCE(p_professional_profile_id, v_profile.id);
  ELSE
    v_professional_id := v_profile.id;
  END IF;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'professional_id é obrigatório' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  v_end_at := p_scheduled_at + make_interval(mins => v_duration);

  v_lock_key := v_profile.tenant_id::text || ':' || v_professional_id::text || ':' || to_char(p_scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key), hashtext('create_appointment_v2'));

  -- Working hours enforcement (if configured)
  IF NOT public.is_slot_within_working_hours_v1(v_profile.tenant_id, v_professional_id, p_scheduled_at, v_end_at) THEN
    RAISE EXCEPTION 'Fora do horário de trabalho do profissional' USING DETAIL = 'OUTSIDE_WORKING_HOURS';
  END IF;

  -- Blocks enforcement (professional-specific or global)
  IF EXISTS (
    SELECT 1
    FROM public.schedule_blocks b
    WHERE b.tenant_id = v_profile.tenant_id
      AND (b.professional_id IS NULL OR b.professional_id = v_professional_id)
      AND b.start_at < v_end_at
      AND b.end_at > p_scheduled_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Horário bloqueado' USING DETAIL = 'SCHEDULE_BLOCKED';
  END IF;

  -- Conflict check: overlap for same professional, ignore cancelled
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.tenant_id = v_profile.tenant_id
      AND a.professional_id = v_professional_id
      AND a.status <> 'cancelled'
      AND a.scheduled_at < v_end_at
      AND (a.scheduled_at + make_interval(mins => a.duration_minutes)) > p_scheduled_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Conflito de horário' USING DETAIL = 'SLOT_CONFLICT';
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    professional_id,
    scheduled_at,
    duration_minutes,
    status,
    price,
    notes
  ) VALUES (
    v_profile.tenant_id,
    p_client_id,
    p_service_id,
    v_professional_id,
    p_scheduled_at,
    v_duration,
    p_status,
    v_price,
    NULLIF(p_notes, '')
  )
  RETURNING id INTO v_appointment_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_created',
    'appointment',
    v_appointment_id::text,
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'duration_minutes', v_duration,
      'status', p_status,
      'professional_profile_id', v_professional_id,
      'client_id', p_client_id,
      'service_id', p_service_id,
      'price', v_price
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'status', p_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamptz, integer, numeric, public.appointment_status, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamptz, integer, numeric, public.appointment_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamptz, integer, numeric, public.appointment_status, text) TO service_role;


CREATE OR REPLACE FUNCTION public.update_appointment_v2(
  p_appointment_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_apt public.appointments%rowtype;
  v_new_professional_id uuid;
  v_new_scheduled_at timestamptz;
  v_new_duration integer;
  v_new_price numeric;
  v_end_at timestamptz;
  v_lock_key text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('update_appointment_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para editar este agendamento' USING DETAIL = 'FORBIDDEN';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido editar um agendamento concluído' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_apt.status = 'confirmed' THEN
    UPDATE public.appointments
    SET notes = NULLIF(p_notes, ''),
        updated_at = now()
    WHERE id = v_apt.id
      AND tenant_id = v_profile.tenant_id;

    PERFORM public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'appointment_notes_updated',
      'appointment',
      v_apt.id::text,
      jsonb_build_object('notes_only', true)
    );

    RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'notes_only', true);
  END IF;

  IF v_is_admin THEN
    v_new_professional_id := COALESCE(p_professional_profile_id, v_apt.professional_id);
  ELSE
    v_new_professional_id := v_profile.id;
  END IF;

  v_new_scheduled_at := COALESCE(p_scheduled_at, v_apt.scheduled_at);
  v_new_duration := COALESCE(p_duration_minutes, v_apt.duration_minutes);
  v_new_price := COALESCE(p_price, v_apt.price);

  IF v_new_duration <= 0 OR v_new_duration > 24*60 THEN
    RAISE EXCEPTION 'duration_minutes inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_new_price < 0 THEN
    RAISE EXCEPTION 'price não pode ser negativo' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_new_professional_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_new_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  v_end_at := v_new_scheduled_at + make_interval(mins => v_new_duration);

  v_lock_key := v_profile.tenant_id::text || ':' || v_new_professional_id::text || ':' || to_char(v_new_scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key), hashtext('update_appointment_v2_conflict'));

  IF NOT public.is_slot_within_working_hours_v1(v_profile.tenant_id, v_new_professional_id, v_new_scheduled_at, v_end_at) THEN
    RAISE EXCEPTION 'Fora do horário de trabalho do profissional' USING DETAIL = 'OUTSIDE_WORKING_HOURS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.schedule_blocks b
    WHERE b.tenant_id = v_profile.tenant_id
      AND (b.professional_id IS NULL OR b.professional_id = v_new_professional_id)
      AND b.start_at < v_end_at
      AND b.end_at > v_new_scheduled_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Horário bloqueado' USING DETAIL = 'SCHEDULE_BLOCKED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.tenant_id = v_profile.tenant_id
      AND a.professional_id = v_new_professional_id
      AND a.id <> v_apt.id
      AND a.status <> 'cancelled'
      AND a.scheduled_at < v_end_at
      AND (a.scheduled_at + make_interval(mins => a.duration_minutes)) > v_new_scheduled_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Conflito de horário' USING DETAIL = 'SLOT_CONFLICT';
  END IF;

  UPDATE public.appointments
  SET client_id = p_client_id,
      service_id = p_service_id,
      professional_id = v_new_professional_id,
      scheduled_at = v_new_scheduled_at,
      duration_minutes = v_new_duration,
      price = v_new_price,
      notes = NULLIF(p_notes, ''),
      updated_at = now()
  WHERE id = v_apt.id
    AND tenant_id = v_profile.tenant_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_updated',
    'appointment',
    v_apt.id::text,
    jsonb_build_object(
      'scheduled_at', v_new_scheduled_at,
      'duration_minutes', v_new_duration,
      'professional_profile_id', v_new_professional_id,
      'client_id', p_client_id,
      'service_id', p_service_id,
      'price', v_new_price
    )
  );

  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'notes_only', false);
END;
$$;

REVOKE ALL ON FUNCTION public.update_appointment_v2(uuid, uuid, uuid, uuid, timestamptz, integer, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_appointment_v2(uuid, uuid, uuid, uuid, timestamptz, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_appointment_v2(uuid, uuid, uuid, uuid, timestamptz, integer, numeric, text) TO service_role;

-- ─── 6. GRANTS (read-only) ──────────────────────────────────────────────────

GRANT SELECT ON public.professional_working_hours TO authenticated;
GRANT SELECT ON public.schedule_blocks TO authenticated;

GRANT ALL ON public.professional_working_hours TO service_role;
GRANT ALL ON public.schedule_blocks TO service_role;
