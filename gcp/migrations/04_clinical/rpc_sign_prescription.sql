CREATE OR REPLACE FUNCTION public.sign_prescription(p_prescription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_rx RECORD;

  v_profile RECORD;

  v_hash TEXT;

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_tenant_id UUID;

BEGIN

  v_tenant_id := public.get_user_tenant_id(v_user_id);

  

  IF v_tenant_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Usu├írio n├úo vinculado a uma cl├¡nica');

  END IF;



  SELECT * INTO v_rx

  FROM public.prescriptions

  WHERE id = p_prescription_id AND tenant_id = v_tenant_id;



  IF NOT FOUND THEN

    RETURN jsonb_build_object('success', false, 'error', 'Receita n├úo encontrada');

  END IF;



  IF v_rx.signed_at IS NOT NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Receita j├í foi assinada digitalmente');

  END IF;



  SELECT full_name, council_number, council_state INTO v_profile

  FROM public.profiles

  WHERE id = v_user_id;



  IF NOT FOUND OR v_profile.full_name IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Perfil do profissional n├úo encontrado');

  END IF;



  IF v_profile.council_number IS NULL OR v_profile.council_number = '' THEN

    RETURN jsonb_build_object('success', false, 'error', 'CRM ├® obrigat├│rio para assinatura digital');

  END IF;



  v_hash := public.generate_prescription_hash(p_prescription_id);



  UPDATE public.prescriptions

  SET 

    digital_signature = v_hash,

    digital_hash = v_hash,

    content_hash = v_hash,

    signed_at = NOW(),

    signed_by_name = v_profile.full_name,

    signed_by_crm = v_profile.council_number,

    signed_by_uf = v_profile.council_state,

    updated_at = NOW()

  WHERE id = p_prescription_id;



  RETURN jsonb_build_object(

    'success', true,

    'hash', v_hash,

    'signed_at', NOW()::TEXT,

    'signed_by', v_profile.full_name,

    'crm', v_profile.council_number

  );

END;

$function$;