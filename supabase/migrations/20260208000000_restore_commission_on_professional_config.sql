-- Migration: Restaurar criação de comissão quando o profissional tem config em Equipe
-- O trigger cria commission_payments SOMENTE quando professional_commissions existe para o profissional.
-- Sem config em Equipe = não cria comissão (admin vê popup; staff vê "contate admin").

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
                RETURN NEW;
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
                                      AND tenant_id = NEW.tenant_id LIMIT 1), 'fixed')
                    END,
                    COALESCE(NEW.commission_amount,
                            COALESCE((SELECT value FROM public.professional_commissions
                                     WHERE user_id = v_professional_user_id
                                     AND tenant_id = NEW.tenant_id LIMIT 1), 0)),
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
                RETURN NEW;
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
                                       WHERE user_id = v_professional_user_id AND tenant_id = NEW.tenant_id LIMIT 1), 'fixed')
                    END,
                    COALESCE(NEW.commission_amount,
                             COALESCE((SELECT value FROM public.professional_commissions
                                      WHERE user_id = v_professional_user_id AND tenant_id = NEW.tenant_id LIMIT 1), 0)),
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
