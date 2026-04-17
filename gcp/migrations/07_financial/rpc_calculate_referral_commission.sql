CREATE OR REPLACE FUNCTION public.calculate_referral_commission(p_appointment_id uuid)
 RETURNS TABLE(referrer_id uuid, referrer_name text, commission_amount numeric, rule_id uuid, calculation_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

    v_appointment RECORD;

    v_rule RECORD;

    v_amount DECIMAL(10,2);

BEGIN

    -- Buscar dados do agendamento

    SELECT 

        a.id,

        a.tenant_id,

        a.booked_by_id,

        a.service_id,

        a.insurance_id,

        COALESCE(s.price, 0) AS service_price,

        p.full_name AS referrer_name

    INTO v_appointment

    FROM public.appointments a

    LEFT JOIN public.services s ON s.id = a.service_id

    LEFT JOIN public.profiles p ON p.user_id = a.booked_by_id

    WHERE a.id = p_appointment_id;



    -- Se n├úo tem booked_by_id, n├úo h├í comiss├úo de capta├º├úo

    IF v_appointment.booked_by_id IS NULL THEN

        RETURN;

    END IF;



    -- Buscar regra de capta├º├úo aplic├ível

    SELECT cr.*

    INTO v_rule

    FROM public.commission_rules cr

    WHERE cr.tenant_id = v_appointment.tenant_id

    AND cr.professional_id = v_appointment.booked_by_id

    AND cr.rule_type = 'referral'

    AND cr.is_active = TRUE

    ORDER BY cr.priority DESC

    LIMIT 1;



    -- Se n├úo encontrou regra espec├¡fica de capta├º├úo, n├úo h├í comiss├úo

    IF v_rule.id IS NULL THEN

        RETURN;

    END IF;



    -- Calcular valor da comiss├úo

    IF v_rule.calculation_type = 'percentage' THEN

        v_amount := (v_appointment.service_price * v_rule.value) / 100;

    ELSIF v_rule.calculation_type = 'fixed' THEN

        v_amount := v_rule.value;

    ELSE

        v_amount := 0;

    END IF;



    -- Retornar resultado

    RETURN QUERY SELECT 

        v_appointment.booked_by_id,

        v_appointment.referrer_name,

        v_amount,

        v_rule.id,

        v_rule.calculation_type::TEXT;

END;

$function$;