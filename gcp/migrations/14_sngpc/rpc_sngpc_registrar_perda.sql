CREATE OR REPLACE FUNCTION public.sngpc_registrar_perda(p_tenant_id uuid, p_estoque_id uuid, p_quantidade integer, p_tipo text, p_motivo text, p_boletim_ocorrencia text DEFAULT NULL::text, p_usuario_id uuid DEFAULT NULL::uuid, p_usuario_nome text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_saldo_atual INTEGER;

  v_mov_id UUID;

BEGIN

  SELECT quantidade_atual INTO v_saldo_atual

  FROM sngpc_estoque WHERE id = p_estoque_id FOR UPDATE;

  

  IF v_saldo_atual < p_quantidade THEN

    RAISE EXCEPTION 'Quantidade a baixar maior que saldo dispon├¡vel';

  END IF;

  

  UPDATE sngpc_estoque 

  SET quantidade_atual = quantidade_atual - p_quantidade,

      updated_at = NOW()

  WHERE id = p_estoque_id;

  

  INSERT INTO sngpc_movimentacoes (

    tenant_id, estoque_id, tipo_movimentacao, quantidade,

    saldo_anterior, saldo_posterior,

    motivo_perda, numero_boletim_ocorrencia,

    usuario_id, usuario_nome

  ) VALUES (

    p_tenant_id, p_estoque_id, p_tipo, p_quantidade,

    v_saldo_atual, v_saldo_atual - p_quantidade,

    p_motivo, p_boletim_ocorrencia,

    p_usuario_id, p_usuario_nome

  ) RETURNING id INTO v_mov_id;

  

  RETURN v_mov_id;

END;

$function$;