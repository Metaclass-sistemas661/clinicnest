CREATE OR REPLACE FUNCTION public.sngpc_proximo_numero(p_tenant_id uuid, p_tipo_receituario text)
 RETURNS TABLE(numero text, serie text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);

  v_sequencial INTEGER;

  v_prefixo TEXT;

BEGIN

  -- Determinar prefixo

  v_prefixo := CASE p_tipo_receituario

    WHEN 'AMARELA' THEN 'A'

    WHEN 'AZUL' THEN 'B'

    ELSE 'C'

  END;

  

  -- Inserir ou atualizar sequencial

  INSERT INTO sngpc_sequencial (tenant_id, tipo_receituario, ano, ultimo_numero)

  VALUES (p_tenant_id, p_tipo_receituario, v_ano, 1)

  ON CONFLICT (tenant_id, tipo_receituario, ano)

  DO UPDATE SET 

    ultimo_numero = sngpc_sequencial.ultimo_numero + 1,

    updated_at = NOW()

  RETURNING ultimo_numero INTO v_sequencial;

  

  RETURN QUERY SELECT 

    LPAD(v_sequencial::TEXT, 6, '0'),

    v_prefixo || v_ano::TEXT;

END;

$function$;