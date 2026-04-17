CREATE OR REPLACE FUNCTION public.notify_patient_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id     uuid;

  v_type        text;

  v_title       text;

  v_body        text;

  v_template    text;

  v_clinic_name text;

  v_metadata    jsonb;

BEGIN

  -- ÔöÇÔöÇ Resolve user_id do paciente ÔöÇÔöÇ

  -- Preferir patient_user_id (auth.uid) quando dispon├¡vel

  v_user_id := NEW.patient_user_id;



  -- Se n├úo tiver, buscar via patient_profiles

  IF v_user_id IS NULL THEN

    SELECT pp.user_id INTO v_user_id

    FROM public.patient_profiles pp

    WHERE pp.client_id = NEW.patient_id

      AND pp.tenant_id = NEW.tenant_id

      AND pp.is_active = true

    LIMIT 1;

  END IF;



  -- Sem user_id = sem notifica├º├úo (paciente sem login)

  IF v_user_id IS NULL THEN

    RETURN NEW;

  END IF;



  -- ÔöÇÔöÇ Buscar t├¡tulo do template ÔöÇÔöÇ

  SELECT COALESCE(ct.title, 'Documento') INTO v_template

  FROM public.consent_templates ct

  WHERE ct.id = NEW.template_id;



  -- ÔöÇÔöÇ Buscar nome da cl├¡nica ÔöÇÔöÇ

  SELECT COALESCE(t.name, '') INTO v_clinic_name

  FROM public.tenants t WHERE t.id = NEW.tenant_id;



  -- ÔòÉÔòÉÔòÉ L├│gica de INSERT ÔòÉÔòÉÔòÉ

  IF TG_OP = 'INSERT' THEN

    IF NEW.signed_at IS NOT NULL THEN

      -- Assinado no momento da cria├º├úo (assinatura direta)

      v_type  := 'consent_signed';

      v_title := 'Documento assinado Ô£à';

      v_body  := format('O termo "%s" foi assinado com sucesso.', v_template);

      v_metadata := jsonb_build_object(

        'consent_id', NEW.id,

        'template_id', NEW.template_id,

        'template_title', v_template,

        'clinic_name', v_clinic_name,

        'signed_at', NEW.signed_at

      );

    ELSE

      -- Criado pendente (ex: auto-gera├º├úo por plano de tratamento)

      v_type  := 'consent_pending';

      v_title := 'Novo documento para assinar ­ƒôï';

      v_body  := format('O termo "%s" est├í aguardando sua assinatura.', v_template);

      v_metadata := jsonb_build_object(

        'consent_id', NEW.id,

        'template_id', NEW.template_id,

        'template_title', v_template,

        'clinic_name', v_clinic_name

      );

    END IF;



  -- ÔòÉÔòÉÔòÉ L├│gica de UPDATE ÔòÉÔòÉÔòÉ

  ELSIF TG_OP = 'UPDATE' THEN

    -- Apenas notifica quando signed_at muda de NULL para NOT NULL

    IF OLD.signed_at IS NULL AND NEW.signed_at IS NOT NULL THEN

      v_type  := 'consent_signed';

      v_title := 'Documento assinado Ô£à';

      v_body  := format('O termo "%s" foi assinado com sucesso.', v_template);

      v_metadata := jsonb_build_object(

        'consent_id', NEW.id,

        'template_id', NEW.template_id,

        'template_title', v_template,

        'clinic_name', v_clinic_name,

        'signed_at', NEW.signed_at

      );

    ELSE

      -- Nenhuma mudan├ºa relevante ÔåÆ sai sem notificar

      RETURN NEW;

    END IF;

  END IF;



  -- ÔöÇÔöÇ Inserir notifica├º├úo ÔöÇÔöÇ

  INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)

  VALUES (v_user_id, v_type, v_title, v_body, v_metadata);



  RETURN NEW;

END;

$function$;