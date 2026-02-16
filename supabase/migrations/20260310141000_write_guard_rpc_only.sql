-- P6: Write-guard (RPC-only writes) for critical tables
-- Blocks direct INSERT/UPDATE/DELETE by roles anon/authenticated.
-- Allows SECURITY DEFINER functions (typically run as postgres) and service_role.

CREATE OR REPLACE FUNCTION public.enforce_rpc_only_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role name := current_user;
BEGIN
  -- Allow internal/admin roles
  IF v_role IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Block end-user direct writes
  IF v_role IN ('anon', 'authenticated') THEN
    PERFORM public.raise_app_error(
      'DIRECT_WRITE_FORBIDDEN',
      format('Operação %s direta bloqueada em %s. Use RPCs.', TG_OP, TG_TABLE_NAME)
    );
  END IF;

  -- Default deny for any unexpected role
  PERFORM public.raise_app_error(
    'DIRECT_WRITE_FORBIDDEN',
    format('Operação %s bloqueada em %s (role=%s).', TG_OP, TG_TABLE_NAME, v_role)
  );
END;
$$;

-- appointments
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_appointments ON public.appointments;
CREATE TRIGGER trg_enforce_rpc_only_writes_appointments
BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- financial_transactions
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_financial_transactions ON public.financial_transactions;
CREATE TRIGGER trg_enforce_rpc_only_writes_financial_transactions
BEFORE INSERT OR UPDATE OR DELETE ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- stock_movements
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_enforce_rpc_only_writes_stock_movements
BEFORE INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- commission_payments (writes should happen via completion RPC / admin RPC)
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_commission_payments ON public.commission_payments;
CREATE TRIGGER trg_enforce_rpc_only_writes_commission_payments
BEFORE INSERT OR UPDATE OR DELETE ON public.commission_payments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- appointment_completion_summaries (should be written only by completion RPC)
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_appointment_completion_summaries ON public.appointment_completion_summaries;
CREATE TRIGGER trg_enforce_rpc_only_writes_appointment_completion_summaries
BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_completion_summaries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();
