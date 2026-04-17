CREATE OR REPLACE FUNCTION public.next_attendance_number(p_tenant_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_next BIGINT;

BEGIN

  INSERT INTO public.tenant_sequences (tenant_id, attendance_seq)

  VALUES (p_tenant_id, 1)

  ON CONFLICT (tenant_id) DO UPDATE

  SET attendance_seq = public.tenant_sequences.attendance_seq + 1,

      updated_at = NOW()

  RETURNING attendance_seq INTO v_next;

  

  RETURN v_next;

END;

$function$;