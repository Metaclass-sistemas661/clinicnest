CREATE OR REPLACE FUNCTION public.sign_medical_certificate(p_certificate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

  v_tenant_id UUID;

  v_cert RECORD;

  v_profile RECORD;

  v_content_hash TEXT;

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



  IF v_cert.signed_at IS NOT NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Atestado j├í foi assinado');

  END IF;



  SELECT full_name, council_number as crm, council_state as uf, 

         CASE 

           WHEN professional_type = 'medico' THEN 'M├®dico(a)'

           WHEN professional_type = 'dentista' THEN 'Cirurgi├úo(├ú)-Dentista'

           WHEN professional_type = 'enfermeiro' THEN 'Enfermeiro(a)'

           WHEN professional_type = 'fisioterapeuta' THEN 'Fisioterapeuta'

           WHEN professional_type = 'nutricionista' THEN 'Nutricionista'

           WHEN professional_type = 'psicologo' THEN 'Psic├│logo(a)'

           WHEN professional_type = 'fonoaudiologo' THEN 'Fonoaudi├│logo(a)'

           ELSE professional_type::text

         END as specialty

  INTO v_profile

  FROM public.profiles

  WHERE user_id = v_user_id;



  IF v_profile.crm IS NULL OR v_profile.crm = '' THEN

    RETURN jsonb_build_object('success', false, 'error', 'Profissional sem n├║mero de conselho cadastrado');

  END IF;



  v_content_hash := public.generate_certificate_hash(p_certificate_id);



  UPDATE public.medical_certificates

  SET 

    digital_signature = v_content_hash,

    content_hash = v_content_hash,

    signed_at = NOW(),

    signed_by_name = v_profile.full_name,

    signed_by_crm = v_profile.crm,

    signed_by_uf = v_profile.uf,

    signed_by_specialty = v_profile.specialty,

    server_timestamp = COALESCE(server_timestamp, NOW()),

    updated_at = NOW()

  WHERE id = p_certificate_id;



  RETURN jsonb_build_object(

    'success', true,

    'hash', v_content_hash,

    'signed_at', NOW(),

    'signed_by', v_profile.full_name,

    'crm', v_profile.crm,

    'uf', v_profile.uf

  );

END;

$function$;