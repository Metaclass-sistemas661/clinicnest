CREATE OR REPLACE FUNCTION public.sign_consent_via_token(p_token text, p_template_id uuid, p_facial_photo_path text, p_ip_address text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_token_record RECORD;

  v_template RECORD;

  v_consent_id UUID;

  v_remaining INT;

BEGIN

  -- Buscar e validar token

  SELECT * INTO v_token_record

  FROM public.consent_signing_tokens

  WHERE token = p_token

    AND expires_at > now()

    AND used_at IS NULL;



  IF v_token_record IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Token inv├ílido, expirado ou j├í utilizado');

  END IF;



  -- Verificar se template est├í na lista permitida

  IF NOT (p_template_id = ANY(v_token_record.template_ids)) THEN

    RETURN jsonb_build_object('success', false, 'error', 'Termo n├úo autorizado para este link');

  END IF;



  -- Buscar template

  SELECT * INTO v_template

  FROM public.consent_templates

  WHERE id = p_template_id

    AND tenant_id = v_token_record.tenant_id

    AND is_active = true;



  IF v_template IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Termo n├úo encontrado ou inativo');

  END IF;



  -- Verificar se j├í foi assinado

  IF EXISTS (

    SELECT 1 FROM public.patient_consents

    WHERE patient_id = v_token_record.patient_id

      AND template_id = p_template_id

  ) THEN

    RETURN jsonb_build_object('success', false, 'error', 'Este termo j├í foi assinado');

  END IF;



  -- Criar assinatura

  INSERT INTO public.patient_consents (

    tenant_id,

    patient_id,

    template_id,

    signed_at,

    ip_address,

    user_agent,

    facial_photo_path,

    template_snapshot_html

  )

  VALUES (

    v_token_record.tenant_id,

    v_token_record.patient_id,

    p_template_id,

    now(),

    p_ip_address,

    p_user_agent,

    p_facial_photo_path,

    v_template.body_html

  )

  RETURNING id INTO v_consent_id;



  -- Contar quantos termos ainda faltam

  SELECT COUNT(*) INTO v_remaining

  FROM public.consent_templates ct

  WHERE ct.id = ANY(v_token_record.template_ids)

    AND ct.is_active = true

    AND NOT EXISTS (

      SELECT 1 FROM public.patient_consents pc

      WHERE pc.patient_id = v_token_record.patient_id

        AND pc.template_id = ct.id

    );



  -- Se todos foram assinados, marcar token como usado

  IF v_remaining = 0 THEN

    UPDATE public.consent_signing_tokens

    SET used_at = now()

    WHERE id = v_token_record.id;

  END IF;



  RETURN jsonb_build_object(

    'success', true,

    'consent_id', v_consent_id,

    'remaining', v_remaining,

    'all_done', v_remaining = 0

  );

END;

$function$;