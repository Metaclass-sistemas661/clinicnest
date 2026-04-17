CREATE OR REPLACE FUNCTION public.check_retention_before_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_client_id UUID;

  v_client_name TEXT;

  v_retention_expires DATE;

  v_tenant_id UUID;

BEGIN

  -- Determina o client_id baseado na tabela

  IF TG_TABLE_NAME = 'clients' THEN

    v_client_id := OLD.id;

    v_tenant_id := OLD.tenant_id;

  ELSIF TG_TABLE_NAME = 'medical_records' THEN

    v_client_id := OLD.client_id;

    v_tenant_id := OLD.tenant_id;

  ELSIF TG_TABLE_NAME = 'prescriptions' THEN

    SELECT client_id, tenant_id INTO v_client_id, v_tenant_id

    FROM medical_records WHERE id = OLD.medical_record_id;

  ELSIF TG_TABLE_NAME = 'triage_records' THEN

    v_client_id := OLD.client_id;

    v_tenant_id := OLD.tenant_id;

  ELSIF TG_TABLE_NAME = 'clinical_evolutions' THEN

    v_client_id := OLD.client_id;

    v_tenant_id := OLD.tenant_id;

  ELSIF TG_TABLE_NAME = 'nursing_evolutions' THEN

    v_client_id := OLD.client_id;

    v_tenant_id := OLD.tenant_id;

  ELSE

    -- Tabela n├úo protegida, permite exclus├úo

    RETURN OLD;

  END IF;

  

  -- Busca dados do cliente

  SELECT name, retention_expires_at 

  INTO v_client_name, v_retention_expires

  FROM clients WHERE id = v_client_id;

  

  -- Se n├úo tem data de expira├º├úo, usa data atual + 20 anos (conservador)

  IF v_retention_expires IS NULL THEN

    v_retention_expires := CURRENT_DATE + INTERVAL '20 years';

  END IF;

  

  -- Verifica se ainda est├í no per├¡odo de reten├º├úo

  IF v_retention_expires > CURRENT_DATE THEN

    -- Registra a tentativa bloqueada

    INSERT INTO retention_deletion_attempts (

      tenant_id, user_id, table_name, record_id, 

      client_id, client_name, retention_expires_at, reason

    ) VALUES (

      v_tenant_id, current_setting('app.current_user_id')::uuid, TG_TABLE_NAME, OLD.id,

      v_client_id, v_client_name, v_retention_expires,

      'Tentativa de exclus├úo bloqueada: dados ainda no per├¡odo de reten├º├úo CFM (expira em ' || 

      TO_CHAR(v_retention_expires, 'DD/MM/YYYY') || ')'

    );

    

    -- Bloqueia a exclus├úo

    RAISE EXCEPTION 'BLOQUEADO: N├úo ├® permitido excluir dados cl├¡nicos antes do per├¡odo de reten├º├úo (CFM 1.821/2007). Este registro s├│ pode ser exclu├¡do ap├│s %', 

      TO_CHAR(v_retention_expires, 'DD/MM/YYYY');

  END IF;

  

  -- Permite exclus├úo se passou do per├¡odo

  RETURN OLD;

END;

$function$;