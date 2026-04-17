CREATE OR REPLACE FUNCTION public.sngpc_registrar_dispensacao(p_tenant_id uuid, p_estoque_id uuid, p_quantidade integer, p_paciente_id uuid, p_paciente_nome text, p_paciente_cpf text, p_prescriptor_nome text, p_prescriptor_crm text, p_numero_receita text, p_comprador_nome text DEFAULT NULL::text, p_comprador_rg text DEFAULT NULL::text, p_comprador_endereco text DEFAULT NULL::text, p_comprador_telefone text DEFAULT NULL::text, p_comprador_parentesco text DEFAULT NULL::text, p_usuario_id uuid DEFAULT NULL::uuid, p_usuario_nome text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_saldo_atual INTEGER;

  v_mov_id UUID;

BEGIN

  -- Obter saldo atual

  SELECT quantidade_atual INTO v_saldo_atual

  FROM sngpc_estoque WHERE id = p_estoque_id FOR UPDATE;

  

  IF v_saldo_atual < p_quantidade THEN

    RAISE EXCEPTION 'Saldo insuficiente. Dispon├¡vel: %, Solicitado: %', v_saldo_atual, p_quantidade;

  END IF;

  

  -- Atualizar estoque

  UPDATE sngpc_estoque 

  SET quantidade_atual = quantidade_atual - p_quantidade,

      updated_at = NOW()

  WHERE id = p_estoque_id;

  

  -- Registrar movimenta├º├úo

  INSERT INTO sngpc_movimentacoes (

    tenant_id, estoque_id, tipo_movimentacao, quantidade,

    saldo_anterior, saldo_posterior,

    paciente_id, paciente_nome, paciente_cpf,

    prescriptor_nome, prescriptor_crm, numero_receita,

    comprador_nome, comprador_rg, comprador_endereco,

    comprador_telefone, comprador_parentesco,

    usuario_id, usuario_nome, observacoes

  ) VALUES (

    p_tenant_id, p_estoque_id, 'SAIDA_DISPENSACAO', p_quantidade,

    v_saldo_atual, v_saldo_atual - p_quantidade,

    p_paciente_id, p_paciente_nome, p_paciente_cpf,

    p_prescriptor_nome, p_prescriptor_crm, p_numero_receita,

    p_comprador_nome, p_comprador_rg, p_comprador_endereco,

    p_comprador_telefone, p_comprador_parentesco,

    p_usuario_id, p_usuario_nome, p_observacoes

  ) RETURNING id INTO v_mov_id;

  

  RETURN v_mov_id;

END;

$function$;