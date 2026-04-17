CREATE OR REPLACE FUNCTION public.auto_submit_to_rnds()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_record RECORD;

  v_patient RECORD;

  v_professional RECORD;

  v_fhir_bundle JSONB;

BEGIN

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    SELECT * INTO v_tenant_record FROM tenants WHERE id = NEW.tenant_id;

    

    IF v_tenant_record.rnds_enabled = TRUE AND v_tenant_record.rnds_auto_send = TRUE THEN

      SELECT * INTO v_patient FROM clients WHERE id = NEW.client_id;

      SELECT * INTO v_professional FROM profiles WHERE id = NEW.professional_id;

      

      IF v_patient.cns IS NOT NULL OR v_patient.cpf IS NOT NULL THEN

        v_fhir_bundle := jsonb_build_object(

          'resourceType', 'Bundle',

          'type', 'transaction',

          'timestamp', NOW(),

          'appointment_id', NEW.id,

          'patient', jsonb_build_object(

            'id', v_patient.id,

            'name', v_patient.name,

            'cpf', v_patient.cpf,

            'cns', v_patient.cns,

            'birth_date', v_patient.birth_date,

            'gender', v_patient.gender

          ),

          'encounter', jsonb_build_object(

            'date', NEW.date,

            'type', NEW.service_type,

            'professional_name', v_professional.full_name,

            'professional_crm', v_professional.crm,

            'professional_cbo', v_professional.cbo,

            'cnes', v_tenant_record.rnds_cnes

          )

        );

        

        INSERT INTO rnds_submissions (

          tenant_id,

          resource_type,

          resource_id,

          fhir_bundle,

          patient_id,

          appointment_id,

          status

        ) VALUES (

          NEW.tenant_id,

          'contato_assistencial',

          NEW.id,

          v_fhir_bundle,

          NEW.client_id,

          NEW.id,

          'pending'

        );

      END IF;

    END IF;

  END IF;

  

  RETURN NEW;

END;

$function$;