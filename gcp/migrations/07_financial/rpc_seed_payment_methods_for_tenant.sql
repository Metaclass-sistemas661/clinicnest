CREATE OR REPLACE FUNCTION public.seed_payment_methods_for_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  INSERT INTO public.payment_methods (tenant_id, code, name, sort_order) VALUES

    (NEW.id, 'cash',     'Dinheiro',       1),

    (NEW.id, 'pix',      'PIX',            2),

    (NEW.id, 'card',     'Cart├úo',         3),

    (NEW.id, 'transfer', 'Transfer├¬ncia',  4)

  ON CONFLICT (tenant_id, code) DO NOTHING;

  RETURN NEW;

END;

$function$;