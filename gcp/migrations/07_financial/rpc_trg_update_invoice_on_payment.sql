CREATE OR REPLACE FUNCTION public.trg_update_invoice_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  IF NEW.status = 'completed' THEN

    UPDATE public.patient_invoices

    SET 

      status = 'paid',

      paid_at = NEW.paid_at,

      paid_amount = NEW.amount,

      payment_method = NEW.payment_method,

      updated_at = now()

    WHERE id = NEW.invoice_id;

  END IF;

  RETURN NEW;

END;

$function$;