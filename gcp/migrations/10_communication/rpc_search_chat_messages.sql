CREATE OR REPLACE FUNCTION public.search_chat_messages(p_query text, p_channel text DEFAULT NULL::text, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, channel text, content text, created_at timestamp with time zone, sender_id uuid, sender_name text, rank real)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

BEGIN

  v_tenant_id := public.get_my_tenant_id();

  

  IF v_tenant_id IS NULL THEN

    RETURN;

  END IF;

  

  RETURN QUERY

  SELECT 

    m.id,

    m.channel,

    m.content,

    m.created_at,

    m.sender_id,

    p.full_name AS sender_name,

    ts_rank(to_tsvector('portuguese', m.content), plainto_tsquery('portuguese', p_query)) AS rank

  FROM public.internal_messages m

  LEFT JOIN public.profiles p ON p.id = m.sender_id

  WHERE m.tenant_id = v_tenant_id

    AND m.deleted_at IS NULL

    AND to_tsvector('portuguese', m.content) @@ plainto_tsquery('portuguese', p_query)

    AND (p_channel IS NULL OR m.channel = p_channel)

  ORDER BY rank DESC, m.created_at DESC

  LIMIT p_limit;

END;

$function$;