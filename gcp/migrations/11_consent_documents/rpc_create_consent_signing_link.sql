CREATE OR REPLACE FUNCTION public.create_consent_signing_link(p_client_id uuid, p_template_ids uuid[] DEFAULT NULL::uuid[], p_expires_hours integer DEFAULT 72)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id UUID;

  v_token TEXT;

  v_template_ids UUID[];

  v_client_name TEXT;

  v_token_id UUID;

BEGIN

  -- Obter tenant do usu├írio

  SELECT get_user_tenant_id(current_setting('app.current_user_id')::uuid) INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo pertence a nenhum tenant';

  END IF;



  -- Verificar se cliente pertence ao tenant

  SELECT name INTO v_client_name

  FROM public.clients

  WHERE id = p_client_id AND tenant_id = v_tenant_id;



  IF v_client_name IS NULL THEN

    RAISE EXCEPTION 'Paciente n├úo encontrado';

  END IF;



  -- Se n├úo especificou templates, pegar todos os ativos obrigat├│rios

  IF p_template_ids IS NULL OR array_length(p_template_ids, 1) IS NULL THEN

    SELECT array_agg(id) INTO v_template_ids

    FROM public.consent_templates

    WHERE tenant_id = v_tenant_id

      AND is_active = true

      AND is_required = true;

  ELSE

    v_template_ids := p_template_ids;

  END IF;



  -- Verificar se h├í templates

  IF v_template_ids IS NULL OR array_length(v_template_ids, 1) IS NULL THEN

    RAISE EXCEPTION 'Nenhum termo dispon├¡vel para assinatura';

  END IF;



  -- Gerar token

  v_token := generate_consent_signing_token();



  -- Criar registro

  INSERT INTO public.consent_signing_tokens (

    tenant_id,

    patient_id,

    token,

    template_ids,

    expires_at,

    created_by

  )

  VALUES (

    v_tenant_id,

    p_client_id,

    v_token,

    v_template_ids,

    now() + (p_expires_hours || ' hours')::interval,

    current_setting('app.current_user_id')::uuid

  )

  RETURNING id INTO v_token_id;



  RETURN jsonb_build_object(

    'success', true,

    'token', v_token,

    'token_id', v_token_id,

    'client_name', v_client_name,

    'template_count', array_length(v_template_ids, 1),

    'expires_at', now() + (p_expires_hours || ' hours')::interval

  );

END;

$function$;