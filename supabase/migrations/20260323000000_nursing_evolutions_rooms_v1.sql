-- Fase 5: Evolução de enfermagem (NANDA/NIC/NOC) + Gestão de salas em tempo real

-- ─── Evolução de Enfermagem ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nursing_evolutions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id    UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  evolution_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NANDA
  nanda_code        TEXT,
  nanda_diagnosis   TEXT NOT NULL,
  -- NIC
  nic_code          TEXT,
  nic_intervention  TEXT,
  nic_activities    TEXT,
  -- NOC
  noc_code          TEXT,
  noc_outcome       TEXT,
  noc_score_initial INTEGER CHECK (noc_score_initial BETWEEN 1 AND 5),
  noc_score_current INTEGER CHECK (noc_score_current BETWEEN 1 AND 5),
  noc_score_target  INTEGER CHECK (noc_score_target  BETWEEN 1 AND 5),
  -- Geral
  notes             TEXT,
  vital_signs       JSONB,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nursing_evo_tenant    ON public.nursing_evolutions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_nursing_evo_client    ON public.nursing_evolutions (client_id);
CREATE INDEX IF NOT EXISTS idx_nursing_evo_prof      ON public.nursing_evolutions (professional_id);
CREATE INDEX IF NOT EXISTS idx_nursing_evo_date      ON public.nursing_evolutions (tenant_id, evolution_date DESC);

ALTER TABLE public.nursing_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nursing_evolutions FORCE ROW LEVEL SECURITY;

CREATE POLICY "nursing_evo_select" ON public.nursing_evolutions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "nursing_evo_insert" ON public.nursing_evolutions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "nursing_evo_update" ON public.nursing_evolutions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "nursing_evo_delete" ON public.nursing_evolutions
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- ─── Gestão de Salas ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_rooms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.clinic_units(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  room_type       TEXT        NOT NULL DEFAULT 'consultation',
  capacity        INTEGER     NOT NULL DEFAULT 1,
  floor           TEXT,
  equipment       TEXT[],
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_rooms_tenant ON public.clinic_rooms (tenant_id);
CREATE INDEX IF NOT EXISTS idx_clinic_rooms_unit   ON public.clinic_rooms (unit_id);

ALTER TABLE public.clinic_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_rooms FORCE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON public.clinic_rooms
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "rooms_insert" ON public.clinic_rooms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "rooms_update" ON public.clinic_rooms
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "rooms_delete" ON public.clinic_rooms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Ocupação em tempo real
CREATE TABLE IF NOT EXISTS public.room_occupancies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  room_id         UUID        NOT NULL REFERENCES public.clinic_rooms(id) ON DELETE CASCADE,
  appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name     TEXT,
  status          TEXT        NOT NULL DEFAULT 'occupied',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_room_occ_tenant ON public.room_occupancies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_room_occ_room   ON public.room_occupancies (room_id);
CREATE INDEX IF NOT EXISTS idx_room_occ_active ON public.room_occupancies (tenant_id, status) WHERE status = 'occupied';

ALTER TABLE public.room_occupancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_occupancies FORCE ROW LEVEL SECURITY;

CREATE POLICY "room_occ_select" ON public.room_occupancies
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "room_occ_insert" ON public.room_occupancies
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "room_occ_update" ON public.room_occupancies
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "room_occ_delete" ON public.room_occupancies
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Habilitar Realtime para ocupação de salas
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_occupancies;
