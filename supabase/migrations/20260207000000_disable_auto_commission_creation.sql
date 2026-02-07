-- Migration: Desativar criação automática de comissão
-- O sistema não pode criar comissão; somente o admin define em Equipe (professional_commissions).
-- Os triggers passam a não inserir em commission_payments.

CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Não criar comissão automaticamente; apenas o admin define em Equipe
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Não criar comissão automaticamente; apenas o admin define em Equipe
  RETURN NEW;
END;
$$;
