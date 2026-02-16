-- Product tour persistence (per user)

CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tour_key text NOT NULL,
  step_index integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tour_key)
);

CREATE INDEX IF NOT EXISTS idx_user_tour_progress_tenant
  ON public.user_tour_progress (tenant_id, tour_key, updated_at DESC);

ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can read own tour progress" ON public.user_tour_progress;
CREATE POLICY "User can read own tour progress"
  ON public.user_tour_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "User can upsert own tour progress" ON public.user_tour_progress;
CREATE POLICY "User can upsert own tour progress"
  ON public.user_tour_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "User can update own tour progress" ON public.user_tour_progress;
CREATE POLICY "User can update own tour progress"
  ON public.user_tour_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS user_tour_progress_updated_at ON public.user_tour_progress;
CREATE TRIGGER user_tour_progress_updated_at
  BEFORE UPDATE ON public.user_tour_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.upsert_user_tour_progress(
  p_tenant_id uuid,
  p_tour_key text,
  p_step_index integer,
  p_completed boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_tour_key IS NULL OR btrim(p_tour_key) = '' THEN
    RAISE EXCEPTION 'tour_key é obrigatório';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  -- Ensure user belongs to tenant
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND p.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence ao tenant';
  END IF;

  INSERT INTO public.user_tour_progress (tenant_id, user_id, tour_key, step_index, completed_at)
  VALUES (
    p_tenant_id,
    v_user_id,
    p_tour_key,
    GREATEST(0, COALESCE(p_step_index, 0)),
    CASE WHEN p_completed THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id, tour_key)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    step_index = EXCLUDED.step_index,
    completed_at = CASE
      WHEN p_completed THEN now()
      ELSE NULL
    END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_user_tour_progress(uuid, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_user_tour_progress(uuid, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_tour_progress(uuid, text, integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_user_tour_progress(
  p_tour_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  DELETE FROM public.user_tour_progress
  WHERE user_id = v_user_id
    AND tour_key = p_tour_key;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_user_tour_progress(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_tour_progress(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_tour_progress(text) TO service_role;
