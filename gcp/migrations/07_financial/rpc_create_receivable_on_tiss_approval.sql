CREATE OR REPLACE FUNCTION public.create_receivable_on_tiss_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  -- Quando uma guia TISS ├® aprovada (status muda para 'approved' ou 'partial')

  IF NEW.status IN ('approved', 'partial') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'partial')) THEN

    -- Criar conta a receber se n├úo existir

    INSERT INTO public.accounts_receivable (

      tenant_id,

      appointment_id,

      client_id,

      tiss_guide_id,

      service_price,

      amount_due,

      amount_paid,

      payment_source,

      status,

      due_date,

      description

    )

    SELECT

      NEW.tenant_id,

      NEW.appointment_id,

      a.client_id,

      NEW.id,

      COALESCE(NEW.approved_value, NEW.total_value, 0),

      COALESCE(NEW.approved_value, NEW.total_value, 0),

      0,

      'insurance'::public.payment_source,

      'pending'::public.receivable_status,

      CURRENT_DATE + INTERVAL '30 days',

      'Guia TISS aprovada: ' || COALESCE(NEW.guide_number, NEW.id::text)

    FROM public.appointments a

    WHERE a.id = NEW.appointment_id

    AND NOT EXISTS (

      SELECT 1 FROM public.accounts_receivable ar

      WHERE ar.tiss_guide_id = NEW.id

    );

  END IF;

  

  RETURN NEW;

END;

$function$;