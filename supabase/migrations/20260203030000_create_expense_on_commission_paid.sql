-- Migration: Criar transação financeira (despesa) quando comissão é marcada como paga
-- As comissões pagas devem aparecer como despesas no financeiro

-- Função para criar despesa quando comissão é marcada como paga
CREATE OR REPLACE FUNCTION public.create_expense_on_commission_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Só processa se o status mudou para 'paid'
    IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
        
        -- Verificar se já existe transação financeira para esta comissão (evitar duplicatas)
        IF NOT EXISTS (
            SELECT 1 FROM public.financial_transactions 
            WHERE appointment_id = NEW.appointment_id
            AND description LIKE '%Comissão%'
            AND amount = NEW.amount
        ) THEN
            -- Criar transação financeira do tipo expense
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
                'Funcionários',
                NEW.amount,
                'Comissão - ' || COALESCE(
                    (SELECT full_name FROM public.profiles WHERE user_id = NEW.professional_id LIMIT 1),
                    'Profissional'
                ),
                COALESCE(NEW.payment_date, CURRENT_DATE)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Criar trigger para criar despesa quando comissão é marcada como paga
DROP TRIGGER IF EXISTS trigger_create_expense_on_commission_paid ON public.commission_payments;
CREATE TRIGGER trigger_create_expense_on_commission_paid
    AFTER UPDATE OF status ON public.commission_payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
    EXECUTE FUNCTION public.create_expense_on_commission_paid();

-- Também criar despesa se comissão já foi criada como "paid" (caso raro)
CREATE OR REPLACE FUNCTION public.create_expense_on_commission_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se a comissão já foi criada como "paid", criar despesa imediatamente
    IF NEW.status = 'paid' THEN
        -- Verificar se já existe transação financeira para esta comissão
        IF NOT EXISTS (
            SELECT 1 FROM public.financial_transactions 
            WHERE appointment_id = NEW.appointment_id
            AND description LIKE '%Comissão%'
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
                'Funcionários',
                NEW.amount,
                'Comissão - ' || COALESCE(
                    (SELECT full_name FROM public.profiles WHERE user_id = NEW.professional_id LIMIT 1),
                    'Profissional'
                ),
                COALESCE(NEW.payment_date, CURRENT_DATE)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Criar trigger para INSERT também
DROP TRIGGER IF EXISTS trigger_create_expense_on_commission_insert ON public.commission_payments;
CREATE TRIGGER trigger_create_expense_on_commission_insert
    AFTER INSERT ON public.commission_payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid')
    EXECUTE FUNCTION public.create_expense_on_commission_insert();
