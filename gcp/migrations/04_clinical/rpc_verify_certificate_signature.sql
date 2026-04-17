CREATE OR REPLACE FUNCTION public.verify_certificate_signature(p_certificate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

  v_tenant_id UUID;

  v_cert RECORD;

  v_current_hash TEXT;

  v_is_valid BOOLEAN;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Usu├írio n├úo autenticado');

  END IF;



  v_tenant_id := public.get_user_tenant_id(v_user_id);

  IF v_tenant_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Tenant n├úo encontrado');

  END IF;



  SELECT * INTO v_cert

  FROM public.medical_certificates

  WHERE id = p_certificate_id AND tenant_id = v_tenant_id;



  IF NOT FOUND THEN

    RETURN jsonb_build_object('success', false, 'error', 'Atestado n├úo encontrado');

  END IF;



  IF v_cert.signed_at IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Atestado n├úo foi assinado');

  END IF;



  v_current_hash := public.generate_certificate_hash(p_certificate_id);

  v_is_valid := (v_current_hash = v_cert.content_hash);



  RETURN jsonb_build_object(

    'success', true,

    'is_valid', v_is_valid,

    'original_hash', v_cert.content_hash,

    'current_hash', v_current_hash,

    'signed_at', v_cert.signed_at,

    'signed_by', v_cert.signed_by_name,

    'crm', v_cert.signed_by_crm,

    'uf', v_cert.signed_by_uf,

    'specialty', v_cert.signed_by_specialty,

    'server_timestamp', v_cert.server_timestamp

  );

END;

$function$;