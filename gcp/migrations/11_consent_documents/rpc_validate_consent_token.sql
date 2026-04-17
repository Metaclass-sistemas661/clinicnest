CREATE OR REPLACE FUNCTION public.validate_consent_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_token_record RECORD;

  v_client RECORD;

  v_tenant RECORD;

  v_templates JSONB;

  v_pending_templates JSONB;

BEGIN

  -- Buscar token

  SELECT * INTO v_token_record

  FROM public.consent_signing_tokens

  WHERE token = p_token;

  

  IF v_token_record IS NULL THEN

    RETURN jsonb_build_object('valid', false, 'error', 'Token inv├ílido ou n├úo encontrado');

  END IF;

  

  -- Verificar expira├º├úo

  IF v_token_record.expires_at < now() THEN

    RETURN jsonb_build_object('valid', false, 'error', 'Link expirado. Solicite um novo link ├á cl├¡nica.');

  END IF;

  

  -- Verificar se j├í foi usado

  IF v_token_record.used_at IS NOT NULL THEN

    RETURN jsonb_build_object('valid', false, 'error', 'Este link j├í foi utilizado.');

  END IF;

  

  -- Buscar dados do cliente

  SELECT id, name, email, phone, cpf, date_of_birth, birth_date,

         street, street_number, neighborhood, city, state, zip_code,

         address_street, address_city, address_state, address_zip

  INTO v_client

  FROM public.clients

  WHERE id = v_token_record.client_id;

  

  IF v_client IS NULL THEN

    RETURN jsonb_build_object('valid', false, 'error', 'Paciente n├úo encontrado');

  END IF;

  

  -- Buscar dados do tenant

  SELECT name, cnpj, address, responsible_doctor, responsible_crm

  INTO v_tenant

  FROM public.tenants

  WHERE id = v_token_record.tenant_id;

  

  -- Buscar templates que ainda n├úo foram assinados

  SELECT jsonb_agg(

    jsonb_build_object(

      'id', ct.id,

      'title', ct.title,

      'slug', ct.slug,

      'body_html', ct.body_html,

      'is_required', ct.is_required,

      'template_type', ct.template_type,

      'pdf_storage_path', ct.pdf_storage_path

    )

  ) INTO v_pending_templates

  FROM public.consent_templates ct

  WHERE ct.id = ANY(v_token_record.template_ids)

    AND ct.is_active = true

    AND NOT EXISTS (

      SELECT 1 FROM public.patient_consents pc

      WHERE pc.client_id = v_token_record.client_id

        AND pc.template_id = ct.id

    );

  

  -- Se todos j├í foram assinados

  IF v_pending_templates IS NULL OR jsonb_array_length(v_pending_templates) = 0 THEN

    -- Marcar token como usado

    UPDATE public.consent_signing_tokens

    SET used_at = now()

    WHERE id = v_token_record.id;

    

    RETURN jsonb_build_object(

      'valid', true,

      'all_signed', true,

      'client_name', v_client.name,

      'clinic_name', v_tenant.name

    );

  END IF;

  

  RETURN jsonb_build_object(

    'valid', true,

    'all_signed', false,

    'token_id', v_token_record.id,

    'client', jsonb_build_object(

      'id', v_client.id,

      'name', v_client.name,

      'email', v_client.email,

      'phone', v_client.phone,

      'cpf', v_client.cpf,

      'date_of_birth', COALESCE(v_client.date_of_birth, v_client.birth_date),

      'address', COALESCE(

        v_client.street || COALESCE(', ' || v_client.street_number, '') || 

        COALESCE(' - ' || v_client.neighborhood, '') || 

        COALESCE(' - ' || v_client.city, '') || 

        COALESCE('/' || v_client.state, ''),

        v_client.address_street || COALESCE(' - ' || v_client.address_city, '') || 

        COALESCE('/' || v_client.address_state, '')

      )

    ),

    'tenant', jsonb_build_object(

      'name', v_tenant.name,

      'cnpj', v_tenant.cnpj,

      'address', v_tenant.address,

      'responsible_doctor', v_tenant.responsible_doctor,

      'responsible_crm', v_tenant.responsible_crm

    ),

    'templates', v_pending_templates

  );

END;

$function$;