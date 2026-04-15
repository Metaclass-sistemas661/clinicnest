-- GCP Migration: Functions - ai_automation
-- Total: 6 functions


-- ============================================
-- Function: get_nps_public_v1
-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
-- ============================================
create or replace function public.get_nps_public_v1(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.nps_responses%rowtype;
  v_tenant_name text;
begin
  select * into v_row
  from public.nps_responses r
  where r.token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select t.name into v_tenant_name
  from public.tenants t
  where t.id = v_row.tenant_id
  limit 1;

  return jsonb_build_object(
    'found', true,
    'tenant_id', v_row.tenant_id,
    'tenant_name', coalesce(v_tenant_name, 'BeautyGest'),
    'appointment_id', v_row.appointment_id,
    'client_id', v_row.client_id,
    'score', v_row.score,
    'comment', v_row.comment,
    'responded_at', v_row.responded_at,
    'created_at', v_row.created_at
  );
end;
$$;


-- ============================================
-- Function: submit_nps_public_v1
-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
-- ============================================
create or replace function public.submit_nps_public_v1(
  p_token uuid,
  p_score integer,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.nps_responses%rowtype;
begin
  if p_score is null or p_score < 0 or p_score > 10 then
    perform public.raise_app_error('VALIDATION_ERROR', 'Score inválido');
  end if;

  select * into v_row
  from public.nps_responses r
  where r.token = p_token
  limit 1;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Token inválido');
  end if;

  if v_row.responded_at is not null then
    return jsonb_build_object('success', true, 'already_responded', true);
  end if;

  update public.nps_responses
    set score = p_score,
        comment = nullif(btrim(coalesce(p_comment,'')),''),
        responded_at = now()
  where token = p_token
    and responded_at is null;

  return jsonb_build_object('success', true, 'already_responded', false);
end;
$$;


-- ============================================
-- Function: call_automation_worker_cron
-- Source: 20260319000002_automation_cron_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.call_automation_worker_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_url text;
  v_worker_key  text;
BEGIN
  v_project_url := current_setting('app.supabase_project_url', true);
  v_worker_key  := current_setting('app.automation_worker_key', true);

  IF v_project_url IS NULL OR v_project_url = '' OR
     v_worker_key IS NULL OR v_worker_key = '' THEN
    RAISE WARNING '[automation-worker] app.supabase_project_url ou app.automation_worker_key não configurado. Consulte o comentário desta migration.';
    RETURN;
  END IF;

  -- Fire and forget via pg_net (async HTTP POST)
  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/automation-worker?since_minutes=10',
    headers := jsonb_build_object(
      'Content-Type',            'application/json',
      'x-automation-worker-key', v_worker_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;


-- ============================================
-- Function: calc_nps
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION calc_nps(
  p_tenant_id UUID,
  p_inicio DATE,
  p_fim DATE
) RETURNS TABLE (
  score NUMERIC,
  promotores INTEGER,
  neutros INTEGER,
  detratores INTEGER,
  total INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND((
      (COUNT(*) FILTER (WHERE rating >= 9)::NUMERIC - COUNT(*) FILTER (WHERE rating <= 6)::NUMERIC) 
      / NULLIF(COUNT(*), 0) * 100
    ), 2) as score,
    COUNT(*) FILTER (WHERE rating >= 9)::INTEGER as promotores,
    COUNT(*) FILTER (WHERE rating BETWEEN 7 AND 8)::INTEGER as neutros,
    COUNT(*) FILTER (WHERE rating <= 6)::INTEGER as detratores,
    COUNT(*)::INTEGER as total
  FROM nps_responses
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_inicio AND p_fim;
END;
$$;


-- ============================================
-- Function: get_ai_usage_summary
-- Source: 20260329200000_ai_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_ai_usage_summary(
    p_tenant_id UUID,
    p_start_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    feature TEXT,
    total_calls BIGINT,
    total_input_tokens BIGINT,
    total_output_tokens BIGINT,
    total_cost_usd DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.feature,
        COUNT(*)::BIGINT as total_calls,
        COALESCE(SUM(al.input_tokens), 0)::BIGINT as total_input_tokens,
        COALESCE(SUM(al.output_tokens), 0)::BIGINT as total_output_tokens,
        COALESCE(SUM(al.cost_usd), 0)::DECIMAL as total_cost_usd
    FROM ai_usage_log al
    WHERE al.tenant_id = p_tenant_id
      AND al.created_at >= p_start_date
      AND al.created_at < p_end_date + INTERVAL '1 day'
    GROUP BY al.feature
    ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: submit_ai_feedback
-- Source: 20260704700000_ai_performance_metrics.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_ai_feedback(
  p_interaction_id uuid,
  p_feedback text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_feedback NOT IN ('accepted', 'rejected', 'partial') THEN
    RAISE EXCEPTION 'Feedback inválido: %', p_feedback;
  END IF;

  UPDATE public.ai_performance_metrics
  SET user_feedback = p_feedback
  WHERE interaction_id = p_interaction_id
    AND tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    );
END;
$$;

