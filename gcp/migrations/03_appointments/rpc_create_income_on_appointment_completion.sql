CREATE OR REPLACE FUNCTION public.create_income_on_appointment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

    -- Only proceed if status changed to 'completed' and price > 0

    IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.price > 0 THEN

        -- Check if income already exists for this appointment

        IF NOT EXISTS (

            SELECT 1 FROM public.financial_transactions 

            WHERE appointment_id = NEW.id

        ) THEN

            INSERT INTO public.financial_transactions (

                tenant_id,

                appointment_id,

                type,

                category,

                amount,

                description,

                transaction_date

            ) VALUES (

                NEW.tenant_id,

                NEW.id,

                'income',

                'Servi├ºo',

                NEW.price,

                'Agendamento conclu├¡do',

                CURRENT_DATE

            );

        END IF;

    END IF;

    

    RETURN NEW;

END;

$function$;