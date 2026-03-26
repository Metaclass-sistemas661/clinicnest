-- ============================================================================
-- SECURITY: Patient Activity Logging
--
-- Registra ações do paciente no portal para auditoria
-- Tabela com RLS (paciente vê apenas seus próprios logs)
-- RPC SECURITY DEFINER para inserção segura
-- ============================================================================

-- 1. Tabela de activity log
CREATE TABLE IF NOT EXISTS public.patient_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,           -- 'login' | 'profile_update' | 'exam_download' | 'prescription_view' | 'consent_sign' | 'data_export' | 'deletion_request' | 'mfa_change' | 'settings_update'
  event_description TEXT,             -- Breve descrição legível
  metadata JSONB DEFAULT '{}',        -- Dados extras (ex: template_id, exam_id)
  ip_hint TEXT,                       -- Últimos octetos apenas
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consulta por paciente + ordenação temporal
CREATE INDEX IF NOT EXISTS idx_patient_activity_log_user_created
  ON public.patient_activity_log (patient_user_id, created_at DESC);

-- RLS
ALTER TABLE public.patient_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_activity_log_select_own"
  ON public.patient_activity_log
  FOR SELECT
  TO authenticated
  USING (patient_user_id = auth.uid());

-- Sem INSERT/UPDATE/DELETE policies — apenas via SECURITY DEFINER

-- 2. RPC para logar atividade
CREATE OR REPLACE FUNCTION public.log_patient_activity(
  p_event_type TEXT,
  p_event_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;  -- Silencioso se não autenticado
  END IF;

  -- Validar event_type
  IF p_event_type NOT IN (
    'login', 'profile_update', 'exam_download', 'prescription_view',
    'consent_sign', 'data_export', 'deletion_request', 'mfa_change',
    'settings_update', 'report_view', 'certificate_view', 'logout'
  ) THEN
    RETURN;  -- Tipo desconhecido, ignorar silenciosamente
  END IF;

  INSERT INTO public.patient_activity_log (
    patient_user_id, event_type, event_description, metadata
  )
  VALUES (
    v_user_id,
    p_event_type,
    left(p_event_description, 500),
    p_metadata
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_patient_activity(TEXT, TEXT, JSONB) TO authenticated;

-- 3. RPC para listar atividades recentes
CREATE OR REPLACE FUNCTION public.get_patient_activity_log(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pal.id,
    pal.event_type,
    pal.event_description,
    pal.metadata,
    pal.created_at
  FROM public.patient_activity_log pal
  WHERE pal.patient_user_id = v_user_id
  ORDER BY pal.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_activity_log(INT, INT) TO authenticated;

-- 4. Limpeza automática (logs > 1 ano)
CREATE OR REPLACE FUNCTION public.cleanup_patient_activity_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.patient_activity_log
  WHERE created_at < now() - interval '1 year';
$$;
