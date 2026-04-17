-- RPC: upsert_client (v1 legacy wrapper)
-- Delegates to upsert_patient — kept for backward compatibility

CREATE OR REPLACE FUNCTION public.upsert_client(
  p_tenant_id uuid,
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_marital_status text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_street text DEFAULT NULL,
  p_street_number text DEFAULT NULL,
  p_complement text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_allergies text DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
BEGIN
  RETURN public.upsert_patient(
    p_tenant_id, p_name, p_phone, p_email, p_notes, p_cpf,
    p_date_of_birth, p_marital_status, p_zip_code, p_street,
    p_street_number, p_complement, p_neighborhood, p_city, p_state, p_allergies
  );
END;
$function$;
