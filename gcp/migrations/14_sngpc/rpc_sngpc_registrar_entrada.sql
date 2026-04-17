CREATE OR REPLACE FUNCTION public.sngpc_registrar_entrada(p_tenant_id uuid, p_medicamento_codigo text, p_medicamento_nome text, p_lista text, p_lote text, p_data_fabricacao date, p_data_validade date, p_quantidade integer, p_unidade text, p_fornecedor_id uuid, p_nota_fiscal text, p_preco_unitario numeric, p_usuario_id uuid, p_usuario_nome text, p_observacoes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_estoque_id UUID;

BEGIN

  -- Inserir no estoque

  INSERT INTO sngpc_estoque (

    tenant_id, medicamento_codigo, medicamento_nome, lista,

    lote, data_fabricacao, data_validade, quantidade_inicial,

    quantidade_atual, unidade, fornecedor_id, nota_fiscal,

    preco_unitario, observacoes

  ) VALUES (

    p_tenant_id, p_medicamento_codigo, p_medicamento_nome, p_lista,

    p_lote, p_data_fabricacao, p_data_validade, p_quantidade,

    p_quantidade, p_unidade, p_fornecedor_id, p_nota_fiscal,

    p_preco_unitario, p_observacoes

  ) RETURNING id INTO v_estoque_id;

  

  -- Registrar movimenta├º├úo

  INSERT INTO sngpc_movimentacoes (

    tenant_id, estoque_id, tipo_movimentacao, quantidade,

    saldo_anterior, saldo_posterior, fornecedor_nome, nota_fiscal,

    usuario_id, usuario_nome, observacoes

  ) VALUES (

    p_tenant_id, v_estoque_id, 'ENTRADA_COMPRA', p_quantidade,

    0, p_quantidade,

    (SELECT name FROM suppliers WHERE id = p_fornecedor_id),

    p_nota_fiscal, p_usuario_id, p_usuario_nome, p_observacoes

  );

  

  RETURN v_estoque_id;

END;

$function$;