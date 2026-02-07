-- Migration: Tenant default commission + fix trigger para usar default quando sem professional_commissions
-- Quando não há configuração de comissão para o profissional, usa default do tenant (se existir)

-- 1. Adicionar coluna default_commission_percent na tabela tenants (nullable, 0-100)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS default_commission_percent DECIMAL(5,2) DEFAULT 10 CHECK (default_commission_percent >= 0 AND default_commission_percent <= 100);

-- 2. Atualizar trigger calculate_commission_on_appointment_completed para usar default do tenant
CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_commission_amount DECIMAL(10,2);
    v_commission_config RECORD;
    v_professional_user_id UUID;
    v_tenant_default DECIMAL(5,2);
BEGIN
    IF NEW.professional_id IS NULL OR NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO v_professional_user_id
    FROM public.profiles
    WHERE id = NEW.professional_id
    LIMIT 1;

    IF v_professional_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        IF EXISTS (
            SELECT 1 FROM public.commission_payments
            WHERE appointment_id = NEW.id
        ) THEN
            RETURN NEW;
        END IF;

        -- Se o agendamento já tem commission_amount definido, usar
        IF NEW.commission_amount IS NOT NULL AND NEW.commission_amount > 0 THEN
            v_commission_amount := NEW.commission_amount;
        ELSE
            SELECT * INTO v_commission_config
            FROM public.professional_commissions
            WHERE user_id = v_professional_user_id
            AND tenant_id = NEW.tenant_id
            LIMIT 1;

            IF v_commission_config IS NOT NULL THEN
                IF v_commission_config.type = 'percentage' THEN
                    v_commission_amount := NEW.price * (v_commission_config.value / 100);
                ELSE
                    v_commission_amount := v_commission_config.value;
                END IF;
            ELSE
                -- Sem config: tentar usar default do tenant
                SELECT COALESCE(default_commission_percent, 0) INTO v_tenant_default
                FROM public.tenants
                WHERE id = NEW.tenant_id
                LIMIT 1;

                IF v_tenant_default IS NOT NULL AND v_tenant_default > 0 THEN
                    v_commission_amount := NEW.price * (v_tenant_default / 100);
                ELSE
                    RETURN NEW;
                END IF;
            END IF;
        END IF;

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
                                      WHERE user_id = v_professional_user_id
                                      AND tenant_id = NEW.tenant_id LIMIT 1), 'percentage')
                    END,
                    COALESCE(NEW.commission_amount,
                            COALESCE((SELECT value FROM public.professional_commissions
                                     WHERE user_id = v_professional_user_id
                                     AND tenant_id = NEW.tenant_id LIMIT 1),
                                     (SELECT default_commission_percent FROM public.tenants
                                      WHERE id = NEW.tenant_id LIMIT 1), 0)),
                    'pending'
                );
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Erro ao criar comissão para agendamento %: %', NEW.id, SQLERRM;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Atualizar também o trigger de INSERT (para agendamentos já criados como completed)
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
    v_tenant_default DECIMAL(5,2);
BEGIN
    IF NEW.professional_id IS NULL OR NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO v_professional_user_id
    FROM public.profiles
    WHERE id = NEW.professional_id
    LIMIT 1;

    IF v_professional_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'completed' THEN
        IF EXISTS (SELECT 1 FROM public.commission_payments WHERE appointment_id = NEW.id) THEN
            RETURN NEW;
        END IF;

        IF NEW.commission_amount IS NOT NULL AND NEW.commission_amount > 0 THEN
            v_commission_amount := NEW.commission_amount;
        ELSE
            SELECT * INTO v_commission_config
            FROM public.professional_commissions
            WHERE user_id = v_professional_user_id AND tenant_id = NEW.tenant_id
            LIMIT 1;

            IF v_commission_config IS NOT NULL THEN
                IF v_commission_config.type = 'percentage' THEN
                    v_commission_amount := NEW.price * (v_commission_config.value / 100);
                ELSE
                    v_commission_amount := v_commission_config.value;
                END IF;
            ELSE
                SELECT COALESCE(default_commission_percent, 0) INTO v_tenant_default
                FROM public.tenants
                WHERE id = NEW.tenant_id
                LIMIT 1;

                IF v_tenant_default IS NOT NULL AND v_tenant_default > 0 THEN
                    v_commission_amount := NEW.price * (v_tenant_default / 100);
                ELSE
                    RETURN NEW;
                END IF;
            END IF;
        END IF;

        IF v_commission_amount IS NOT NULL AND v_commission_amount > 0 THEN
            BEGIN
                INSERT INTO public.commission_payments (
                    tenant_id, professional_id, appointment_id, commission_config_id,
                    amount, service_price, commission_type, commission_value, status
                ) VALUES (
                    NEW.tenant_id,
                    v_professional_user_id,
                    NEW.id,
                    COALESCE((SELECT id FROM public.professional_commissions
                             WHERE user_id = v_professional_user_id AND tenant_id = NEW.tenant_id LIMIT 1), NULL),
                    v_commission_amount,
                    NEW.price,
                    CASE WHEN NEW.commission_amount IS NOT NULL THEN 'fixed'
                         ELSE COALESCE((SELECT type FROM public.professional_commissions
                                       WHERE user_id = v_professional_user_id AND tenant_id = NEW.tenant_id LIMIT 1), 'percentage')
                    END,
                    COALESCE(NEW.commission_amount,
                             COALESCE((SELECT value FROM public.professional_commissions
                                      WHERE user_id = v_professional_user_id AND tenant_id = NEW.tenant_id LIMIT 1),
                                      (SELECT default_commission_percent FROM public.tenants
                                       WHERE id = NEW.tenant_id LIMIT 1), 0)),
                    'pending'
                );
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Erro ao criar comissão para agendamento %: %', NEW.id, SQLERRM;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
