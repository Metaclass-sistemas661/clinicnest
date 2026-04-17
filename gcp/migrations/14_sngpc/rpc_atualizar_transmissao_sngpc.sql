CREATE OR REPLACE FUNCTION public.atualizar_transmissao_sngpc(p_transmissao_id uuid, p_status sngpc_transmissao_status, p_hash character varying DEFAULT NULL::character varying, p_resposta jsonb DEFAULT NULL::jsonb, p_erros text[] DEFAULT NULL::text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

BEGIN

  -- Verificar permiss├úo

  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;

  

  IF NOT EXISTS (

    SELECT 1 FROM sngpc_transmissoes 

    WHERE id = p_transmissao_id AND tenant_id = v_tenant_id

  ) THEN

    RAISE EXCEPTION 'Transmiss├úo n├úo encontrada ou sem permiss├úo';

  END IF;

  

  -- Atualizar transmiss├úo

  UPDATE sngpc_transmissoes SET

    status = p_status,

    hash_anvisa = COALESCE(p_hash, hash_anvisa),

    resposta_anvisa = COALESCE(p_resposta, resposta_anvisa),

    erros = COALESCE(p_erros, erros),

    data_envio = CASE WHEN p_status IN ('enviado', 'validado', 'erro', 'rejeitado') THEN COALESCE(data_envio, NOW()) ELSE data_envio END,

    data_validacao = CASE WHEN p_status = 'validado' THEN NOW() ELSE data_validacao END

  WHERE id = p_transmissao_id;

  

  RETURN TRUE;

END;

$function$;