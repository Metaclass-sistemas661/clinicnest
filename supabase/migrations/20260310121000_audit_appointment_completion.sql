-- P1: Audit appointment completions via completion summaries insert trigger

CREATE OR REPLACE FUNCTION public.audit_appointment_completion_summary_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  PERFORM public.log_tenant_action(
    NEW.tenant_id,
    COALESCE(v_actor_user_id, NULL),
    'appointment_completed',
    'appointment',
    COALESCE(NEW.appointment_id::text, NULL),
    jsonb_build_object(
      'summary_id', NEW.id::text,
      'service_name', NEW.service_name,
      'professional_name', NEW.professional_name,
      'service_profit', NEW.service_profit,
      'product_profit_total', NEW.product_profit_total,
      'total_profit', NEW.total_profit
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_appointment_completion_summary_insert ON public.appointment_completion_summaries;
CREATE TRIGGER trg_audit_appointment_completion_summary_insert
AFTER INSERT ON public.appointment_completion_summaries
FOR EACH ROW
EXECUTE FUNCTION public.audit_appointment_completion_summary_insert();
