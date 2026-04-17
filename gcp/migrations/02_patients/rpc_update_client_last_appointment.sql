CREATE OR REPLACE FUNCTION public.update_client_last_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_retention_years INTEGER;

BEGIN

  -- S├│ atualiza se o appointment foi completado

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- Busca o per├¡odo de reten├º├úo do tenant

    SELECT COALESCE(retention_years, 20) INTO v_retention_years

    FROM tenants WHERE id = NEW.tenant_id;

    

    -- Atualiza o cliente

    UPDATE clients

    SET 

      last_appointment_date = NEW.date,

      retention_expires_at = NEW.date + (v_retention_years || ' years')::INTERVAL,

      updated_at = NOW()

    WHERE id = NEW.client_id

      AND (last_appointment_date IS NULL OR last_appointment_date < NEW.date);

  END IF;

  

  RETURN NEW;

END;

$function$;