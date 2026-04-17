CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id uuid, p_rpc_name text, p_max_per_minute integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_window TIMESTAMPTZ := date_trunc('minute', NOW());

  v_count INTEGER;

BEGIN

  -- Cleanup old windows (older than 5 minutes)

  DELETE FROM public.rpc_rate_limits 

  WHERE window_start < v_window - INTERVAL '5 minutes';

  

  -- Upsert current window

  INSERT INTO public.rpc_rate_limits (user_id, rpc_name, window_start, call_count)

  VALUES (p_user_id, p_rpc_name, v_window, 1)

  ON CONFLICT (user_id, rpc_name, window_start)

  DO UPDATE SET call_count = rpc_rate_limits.call_count + 1

  RETURNING call_count INTO v_count;

  

  RETURN v_count <= p_max_per_minute;

END;

$function$;