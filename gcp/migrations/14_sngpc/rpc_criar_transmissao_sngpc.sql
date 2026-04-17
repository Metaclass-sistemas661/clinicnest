CREATE OR REPLACE FUNCTION public.criar_transmissao_sngpc(p_tipo sngpc_transmissao_tipo, p_data_inicio date, p_data_fim date, p_xml text, p_total_entradas integer DEFAULT 0, p_total_saidas_venda integer DEFAULT 0, p_total_saidas_transferencia integer DEFAULT 0, p_total_saidas_perda integer DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

  v_user_id UUID;

  v_user_name TEXT;

  v_transmissao_id UUID;

BEGIN

  -- Obter tenant e usu├írio

  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;

  v_user_id := current_setting('app.current_user_id')::uuid;

  SELECT full_name INTO v_user_name FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;

  

  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo associado a um tenant';

  END IF;

  

  -- Criar transmiss├úo

  INSERT INTO sngpc_transmissoes (

    tenant_id,

    tipo,

    data_inicio,

    data_fim,

    xml_enviado,

    status,

    total_entradas,

    total_saidas_venda,

    total_saidas_transferencia,

    total_saidas_perda,

    total_medicamentos,

    enviado_por,

    enviado_por_nome

  ) VALUES (

    v_tenant_id,

    p_tipo,

    p_data_inicio,

    p_data_fim,

    p_xml,

    'pendente',

    p_total_entradas,

    p_total_saidas_venda,

    p_total_saidas_transferencia,

    p_total_saidas_perda,

    p_total_entradas + p_total_saidas_venda + p_total_saidas_transferencia + p_total_saidas_perda,

    v_user_id,

    v_user_name

  )

  RETURNING id INTO v_transmissao_id;

  

  -- Registrar log

  INSERT INTO sngpc_transmissoes_log (

    transmissao_id,

    acao,

    status_novo,

    executado_por

  ) VALUES (

    v_transmissao_id,

    'criacao',

    'pendente',

    v_user_id

  );

  

  RETURN v_transmissao_id;

END;

$function$;