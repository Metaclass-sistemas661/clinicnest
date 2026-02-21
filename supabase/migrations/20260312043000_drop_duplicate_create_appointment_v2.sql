-- Drop the old overload of create_appointment_v2 where p_scheduled_at was the
-- first positional parameter.  This signature was introduced in
-- 20260310100000_enterprise_agenda_finance_rpcs.sql and later superseded by the
-- version with (p_client_id, p_service_id, …, p_scheduled_at, …) in
-- 20260310131000 / 20260311000000.  Having both overloads causes Postgres to
-- raise "Could not choose the best candidate function" when the RPC is called
-- with named parameters.

DROP FUNCTION IF EXISTS public.create_appointment_v2(
  p_scheduled_at timestamptz,
  p_client_id uuid,
  p_service_id uuid,
  p_professional_profile_id uuid,
  p_duration_minutes integer,
  p_price numeric,
  p_status public.appointment_status,
  p_notes text
);
