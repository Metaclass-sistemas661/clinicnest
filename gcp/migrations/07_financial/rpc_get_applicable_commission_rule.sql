CREATE OR REPLACE FUNCTION public.get_applicable_commission_rule(p_tenant_id uuid, p_professional_id uuid, p_procedure_id uuid DEFAULT NULL::uuid, p_insurance_id uuid DEFAULT NULL::uuid, p_procedure_code text DEFAULT NULL::text)
 RETURNS TABLE(rule_id uuid, rule_type commission_rule_type, calculation_type commission_calculation_type, value numeric, tier_config jsonb, is_inverted boolean, priority integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

    -- Retorna a regra mais espec├¡fica (maior prioridade) que se aplica.

    -- Ordem de prioridade: procedure (30) > service (20) > insurance (10) > referral (5) > default (0)

    RETURN QUERY

    SELECT

        cr.id AS rule_id,

        cr.rule_type,

        cr.calculation_type,

        cr.value,

        cr.tier_config,

        cr.is_inverted,

        cr.priority

    FROM public.commission_rules cr

    WHERE cr.tenant_id = p_tenant_id

      AND cr.professional_id = p_professional_id

      AND cr.is_active = TRUE

      AND (

          -- Regra por c├│digo TUSS (procedimento ÔÇö mais espec├¡fica)

          (cr.rule_type = 'procedure' AND cr.procedure_code = p_procedure_code AND p_procedure_code IS NOT NULL)

          OR

          -- Regra por procedimento/servi├ºo cadastrado

          (cr.rule_type = 'service' AND cr.procedure_id = p_procedure_id AND p_procedure_id IS NOT NULL)

          OR

          -- Regra por conv├¬nio

          (cr.rule_type = 'insurance' AND cr.insurance_id = p_insurance_id AND p_insurance_id IS NOT NULL)

          OR

          -- Regra default (fallback)

          (cr.rule_type = 'default')

      )

    ORDER BY cr.priority DESC, cr.created_at DESC

    LIMIT 1;

END;

$function$;