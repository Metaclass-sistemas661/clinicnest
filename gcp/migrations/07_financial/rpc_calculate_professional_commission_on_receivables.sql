CREATE OR REPLACE FUNCTION public.calculate_professional_commission_on_receivables(p_professional_id uuid, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_tenant_id UUID;

  v_commission_config RECORD;

  v_total_received NUMERIC := 0;

  v_commission_amount NUMERIC := 0;

  v_receivables_count INTEGER := 0;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  -- Buscar tenant do profissional

  SELECT tenant_id INTO v_tenant_id

  FROM public.profiles

  WHERE id = p_professional_id

  LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Profissional n├úo encontrado';

  END IF;



  -- Verificar permiss├Áes

  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem calcular comiss├Áes';

  END IF;



  -- Buscar configura├º├úo de comiss├úo do profissional

  SELECT pc.*

  INTO v_commission_config

  FROM public.professional_commissions pc

  JOIN public.profiles p ON p.user_id = pc.user_id

  WHERE p.id = p_professional_id

    AND pc.tenant_id = v_tenant_id

    AND (pc.payment_type IS NULL OR lower(trim(pc.payment_type)) = 'commission')

  ORDER BY pc.updated_at DESC NULLS LAST

  LIMIT 1;



  IF v_commission_config IS NULL THEN

    RETURN jsonb_build_object(

      'success', false,

      'error', 'Profissional n├úo possui configura├º├úo de comiss├úo',

      'total_received', 0,

      'commission_amount', 0

    );

  END IF;



  -- Calcular total recebido no per├¡odo

  SELECT 

    COALESCE(SUM(ar.amount_paid), 0),

    COUNT(*)

  INTO v_total_received, v_receivables_count

  FROM public.accounts_receivable ar

  WHERE ar.professional_id = p_professional_id

    AND ar.tenant_id = v_tenant_id

    AND ar.status IN ('paid', 'partial')

    AND ar.paid_at >= p_start_date

    AND ar.paid_at < (p_end_date + INTERVAL '1 day');



  -- Calcular comiss├úo

  IF v_commission_config.type = 'percentage' THEN

    v_commission_amount := v_total_received * (v_commission_config.value / 100);

  ELSE

    -- Comiss├úo fixa por atendimento

    v_commission_amount := v_commission_config.value * v_receivables_count;

  END IF;



  RETURN jsonb_build_object(

    'success', true,

    'professional_id', p_professional_id,

    'period_start', p_start_date,

    'period_end', p_end_date,

    'total_received', v_total_received,

    'receivables_count', v_receivables_count,

    'commission_type', v_commission_config.type,

    'commission_value', v_commission_config.value,

    'commission_amount', v_commission_amount

  );

END;

$function$;