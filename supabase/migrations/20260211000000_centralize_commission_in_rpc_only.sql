-- Migration: Centralizar criação de comissão APENAS no RPC
-- Remove a duplicação entre trigger e RPC. Agora só complete_appointment_with_sale cria comissões.
-- Evita conflitos e facilita debug.

CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Comissão é criada pelo RPC complete_appointment_with_sale, não pelo trigger
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
  -- Comissão é criada pelo RPC complete_appointment_with_sale, não pelo trigger
  RETURN NEW;
END;
$$;
