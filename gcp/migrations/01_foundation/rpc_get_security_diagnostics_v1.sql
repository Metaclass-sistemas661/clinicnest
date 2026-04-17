CREATE OR REPLACE FUNCTION public.get_security_diagnostics_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_tables text[] := ARRAY[

    'appointments',

    'clients',

    'services',

    'products',

    'product_categories',

    'stock_movements',

    'financial_transactions',

    'commission_payments',

    'goals',

    'goal_templates',

    'audit_logs',

    'appointment_completion_summaries'

  ];

  v_table text;

  v_rls jsonb := '[]'::jsonb;

  v_triggers jsonb := '[]'::jsonb;

  v_functions jsonb := '[]'::jsonb;

  v_indexes jsonb := '[]'::jsonb;

BEGIN

  IF v_user_id IS NULL THEN

    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT * INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF NOT FOUND THEN

    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil n├úo encontrado');

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN

    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode acessar diagn├│stico');

  END IF;



  -- RLS checks

  FOREACH v_table IN ARRAY v_tables LOOP

    v_rls := v_rls || jsonb_build_array(

      jsonb_build_object(

        'table', v_table,

        'rls_enabled', coalesce((

          select c.relrowsecurity

          from pg_class c

          join pg_namespace n on n.oid = c.relnamespace

          where n.nspname = 'public'

            and c.relkind = 'r'

            and c.relname = v_table

        ), false),

        'rls_forced', coalesce((

          select c.relforcerowsecurity

          from pg_class c

          join pg_namespace n on n.oid = c.relnamespace

          where n.nspname = 'public'

            and c.relkind = 'r'

            and c.relname = v_table

        ), false)

      )

    );

  END LOOP;



  -- Trigger checks (write-guard)

  v_triggers := jsonb_build_array(

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_appointments',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_appointments')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_financial_transactions',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_financial_transactions')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_stock_movements',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_stock_movements')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_commission_payments',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_commission_payments')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_appointment_completion_summaries',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_appointment_completion_summaries')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_services',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_services')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_clients',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_clients')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_goals',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_goals')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_goal_templates',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_goal_templates')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_product_categories',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_product_categories')

    ),

    jsonb_build_object(

      'name', 'trg_enforce_rpc_only_writes_products',

      'exists', exists(select 1 from pg_trigger where tgname = 'trg_enforce_rpc_only_writes_products')

    )

  );



  -- Function checks

  v_functions := jsonb_build_array(

    jsonb_build_object('name','raise_app_error','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='raise_app_error')),

    jsonb_build_object('name','enforce_rpc_only_writes','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='enforce_rpc_only_writes')),

    jsonb_build_object('name','get_my_context','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='get_my_context')),

    jsonb_build_object('name','create_appointment_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='create_appointment_v2')),

    jsonb_build_object('name','update_appointment_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='update_appointment_v2')),

    jsonb_build_object('name','set_appointment_status_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='set_appointment_status_v2')),

    jsonb_build_object('name','delete_appointment_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='delete_appointment_v2')),

    jsonb_build_object('name','create_financial_transaction_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='create_financial_transaction_v2')),

    jsonb_build_object('name','create_product_v2','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='create_product_v2')),

    jsonb_build_object('name','adjust_stock','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='adjust_stock')),

    jsonb_build_object('name','cancel_appointment','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='cancel_appointment')),

    jsonb_build_object('name','mark_commission_paid','exists', exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='mark_commission_paid'))

  );



  -- Index checks (best effort)

  v_indexes := jsonb_build_array(

    jsonb_build_object('name','idx_appointments_tenant_professional_scheduled_at_not_cancelled','exists', exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_appointments_tenant_professional_scheduled_at_not_cancelled')),

    jsonb_build_object('name','idx_audit_logs_tenant_created_at','exists', exists(select 1 from pg_indexes where schemaname='public' and indexname='idx_audit_logs_tenant_created_at'))

  );



  RETURN jsonb_build_object(

    'tenant_id', v_profile.tenant_id,

    'generated_at', now(),

    'rls', v_rls,

    'triggers', v_triggers,

    'functions', v_functions,

    'indexes', v_indexes

  );

END;

$function$;