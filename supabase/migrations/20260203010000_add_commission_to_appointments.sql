-- Migration: Adicionar campo commission_amount na tabela appointments
-- Permite definir comissão específica por agendamento

-- 1. Adicionar campo commission_amount na tabela appointments
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) CHECK (commission_amount >= 0);

-- 2. Atualizar função do trigger para usar commission_amount do agendamento
CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_commission_amount DECIMAL(10,2);
    v_commission_config RECORD;
BEGIN
    -- Validar que profissional e tenant estão presentes
    IF NEW.professional_id IS NULL OR NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Só processa se o status mudou para 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Verificar se já existe comissão para este agendamento (evitar duplicatas)
        IF EXISTS (
            SELECT 1 FROM public.commission_payments 
            WHERE appointment_id = NEW.id
        ) THEN
            RETURN NEW;
        END IF;
        
        -- Se o agendamento já tem commission_amount definido, usar esse valor
        IF NEW.commission_amount IS NOT NULL AND NEW.commission_amount > 0 THEN
            v_commission_amount := NEW.commission_amount;
        ELSE
            -- Caso contrário, buscar configuração de comissão do profissional
            SELECT * INTO v_commission_config
            FROM public.professional_commissions
            WHERE user_id = NEW.professional_id
            AND tenant_id = NEW.tenant_id
            LIMIT 1;

            -- Se existe configuração, calcular valor da comissão
            IF v_commission_config IS NOT NULL THEN
                IF v_commission_config.type = 'percentage' THEN
                    v_commission_amount := NEW.price * (v_commission_config.value / 100);
                ELSE
                    v_commission_amount := v_commission_config.value;
                END IF;
            ELSE
                -- Sem configuração e sem commission_amount, não criar comissão
                RETURN NEW;
            END IF;
        END IF;

        -- Criar registro de comissão pendente apenas se v_commission_amount foi calculado
        IF v_commission_amount IS NOT NULL AND v_commission_amount > 0 THEN
            BEGIN
                INSERT INTO public.commission_payments (
                    tenant_id,
                    professional_id,
                    appointment_id,
                    commission_config_id,
                    amount,
                    service_price,
                    commission_type,
                    commission_value,
                    status
                ) VALUES (
                    NEW.tenant_id,
                    v_professional_user_id,
                    NEW.id,
                    COALESCE((SELECT id FROM public.professional_commissions 
                             WHERE user_id = v_professional_user_id 
                             AND tenant_id = NEW.tenant_id LIMIT 1), NULL),
                    v_commission_amount,
                    NEW.price,
                    CASE 
                        WHEN NEW.commission_amount IS NOT NULL THEN 'fixed'
                        ELSE COALESCE((SELECT type FROM public.professional_commissions 
                                      WHERE user_id = NEW.professional_id 
                                      AND tenant_id = NEW.tenant_id LIMIT 1), 'fixed')
                    END,
                    COALESCE(NEW.commission_amount, 
                            COALESCE((SELECT value FROM public.professional_commissions 
                                     WHERE user_id = NEW.professional_id 
                                     AND tenant_id = NEW.tenant_id LIMIT 1), 0)),
                    'pending'
                );
            EXCEPTION WHEN OTHERS THEN
                -- Log do erro mas não falha o trigger
                RAISE WARNING 'Erro ao criar comissão para agendamento %: %', NEW.id, SQLERRM;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Criar função para calcular comissão em INSERT também (caso agendamento já seja criado como completed)
CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_commission_amount DECIMAL(10,2);
    v_commission_config RECORD;
    v_professional_user_id UUID;
BEGIN
    -- Validar que profissional e tenant estão presentes
    IF NEW.professional_id IS NULL OR NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Converter professional_id (profiles.id) para user_id (profiles.user_id)
    SELECT user_id INTO v_professional_user_id
    FROM public.profiles
    WHERE id = NEW.professional_id
    LIMIT 1;
    
    IF v_professional_user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Só processa se o status é 'completed' na criação
    IF NEW.status = 'completed' THEN
        
        -- Verificar se já existe comissão para este agendamento (evitar duplicatas)
        IF EXISTS (
            SELECT 1 FROM public.commission_payments 
            WHERE appointment_id = NEW.id
        ) THEN
            RETURN NEW;
        END IF;
        
        -- Se o agendamento já tem commission_amount definido, usar esse valor
        IF NEW.commission_amount IS NOT NULL AND NEW.commission_amount > 0 THEN
            v_commission_amount := NEW.commission_amount;
        ELSE
            -- Caso contrário, buscar configuração de comissão do profissional
            SELECT * INTO v_commission_config
            FROM public.professional_commissions
            WHERE user_id = v_professional_user_id
            AND tenant_id = NEW.tenant_id
            LIMIT 1;

            -- Se existe configuração, calcular valor da comissão
            IF v_commission_config IS NOT NULL THEN
                IF v_commission_config.type = 'percentage' THEN
                    v_commission_amount := NEW.price * (v_commission_config.value / 100);
                ELSE
                    v_commission_amount := v_commission_config.value;
                END IF;
            ELSE
                -- Sem configuração e sem commission_amount, não criar comissão
                RETURN NEW;
            END IF;
        END IF;

        -- Criar registro de comissão pendente apenas se v_commission_amount foi calculado
        IF v_commission_amount IS NOT NULL AND v_commission_amount > 0 THEN
            BEGIN
                INSERT INTO public.commission_payments (
                    tenant_id,
                    professional_id,
                    appointment_id,
                    commission_config_id,
                    amount,
                    service_price,
                    commission_type,
                    commission_value,
                    status
                ) VALUES (
                    NEW.tenant_id,
                    v_professional_user_id,
                    NEW.id,
                    COALESCE((SELECT id FROM public.professional_commissions 
                             WHERE user_id = v_professional_user_id 
                             AND tenant_id = NEW.tenant_id LIMIT 1), NULL),
                    v_commission_amount,
                    NEW.price,
                    CASE 
                        WHEN NEW.commission_amount IS NOT NULL THEN 'fixed'
                        ELSE COALESCE((SELECT type FROM public.professional_commissions 
                                      WHERE user_id = NEW.professional_id 
                                      AND tenant_id = NEW.tenant_id LIMIT 1), 'fixed')
                    END,
                    COALESCE(NEW.commission_amount, 
                            COALESCE((SELECT value FROM public.professional_commissions 
                                     WHERE user_id = NEW.professional_id 
                                     AND tenant_id = NEW.tenant_id LIMIT 1), 0)),
                    'pending'
                );
            EXCEPTION WHEN OTHERS THEN
                -- Log do erro mas não falha o trigger
                RAISE WARNING 'Erro ao criar comissão para agendamento %: %', NEW.id, SQLERRM;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Criar trigger para INSERT
DROP TRIGGER IF EXISTS trigger_calculate_commission_on_insert ON public.appointments;
CREATE TRIGGER trigger_calculate_commission_on_insert
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION public.calculate_commission_on_appointment_insert();

-- 5. Recriar trigger para UPDATE (garantir que está atualizado)
DROP TRIGGER IF EXISTS trigger_calculate_commission_on_completed ON public.appointments;
CREATE TRIGGER trigger_calculate_commission_on_completed
    AFTER UPDATE OF status ON public.appointments
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
    EXECUTE FUNCTION public.calculate_commission_on_appointment_completed();

-- 6. Comentário explicativo
COMMENT ON COLUMN public.appointments.commission_amount IS 'Valor da comissão específica para este agendamento. Se definido, será usado ao invés da configuração geral do profissional.';
