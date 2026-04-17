CREATE OR REPLACE FUNCTION public.create_expense_on_commission_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  v_desc text;

begin

  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then

    v_desc := 'Comiss├úo - ' || coalesce(

      (select full_name from public.profiles where user_id = new.professional_id limit 1),

      'Profissional'

    );



    insert into public.financial_transactions (

      tenant_id,

      appointment_id,

      type,

      category,

      amount,

      description,

      transaction_date,

      commission_payment_id

    ) values (

      new.tenant_id,

      new.appointment_id,

      'expense',

      'Funcion├írios',

      new.amount,

      v_desc,

      coalesce(new.payment_date, current_date),

      new.id

    )

    on conflict (commission_payment_id) do nothing;

  end if;



  return new;

end;

$function$;