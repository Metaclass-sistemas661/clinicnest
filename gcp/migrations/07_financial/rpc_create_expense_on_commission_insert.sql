CREATE OR REPLACE FUNCTION public.create_expense_on_commission_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

    -- Se a comiss├úo j├í foi criada como "paid", criar despesa imediatamente

    IF NEW.status = 'paid' THEN

        -- Verificar se j├í existe transa├º├úo financeira para esta comiss├úo

        IF NOT EXISTS (

            SELECT 1 FROM public.financial_transactions 

            WHERE appointment_id = NEW.appointment_id

            AND description LIKE '%Comiss├úo%'

            AND amount = NEW.amount

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

                NEW.appointment_id,

                'expense',

                'Funcion├írios',

                NEW.amount,

                'Comiss├úo - ' || COALESCE(

                    (SELECT full_name FROM public.profiles WHERE user_id = NEW.professional_id LIMIT 1),

                    'Profissional'

                ),

                COALESCE(NEW.payment_date, CURRENT_DATE)

            );

        END IF;

    END IF;



    RETURN NEW;

END;

$function$;