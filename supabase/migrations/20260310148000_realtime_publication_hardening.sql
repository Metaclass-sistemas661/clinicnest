-- P13: Realtime / publication hardening
-- Goal: ensure supabase_realtime publishes only the tables we explicitly allow.

DO $$
BEGIN
  -- Remove common sensitive tables if they were ever added
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.appointments;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.clients;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.services;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.products;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.product_categories;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.stock_movements;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_transactions;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.commission_payments;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.goals;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.goal_templates;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs;
  EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
  END;

  -- Ensure the only intended realtime table remains enabled
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_completion_summaries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
