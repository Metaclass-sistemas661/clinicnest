-- Create trigger to generate income when appointment is completed
CREATE OR REPLACE FUNCTION public.create_income_on_appointment_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
                'Serviço',
                NEW.price,
                'Agendamento concluído',
                CURRENT_DATE
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on appointments table
DROP TRIGGER IF EXISTS trigger_create_income_on_completion ON public.appointments;
CREATE TRIGGER trigger_create_income_on_completion
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.create_income_on_appointment_completion();