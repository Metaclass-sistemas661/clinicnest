CREATE OR REPLACE FUNCTION public.get_archived_client_data(p_tenant_id uuid, p_client_cpf text DEFAULT NULL::text, p_client_name text DEFAULT NULL::text)
 RETURNS TABLE(archive_id uuid, client_name text, client_cpf text, last_appointment date, archived_at timestamp with time zone, has_pdf boolean, has_xml boolean, total_records integer, data_hash text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    acd.id as archive_id,

    acd.client_name,

    acd.client_cpf,

    acd.last_appointment_date as last_appointment,

    acd.archived_at,

    acd.export_pdf_url IS NOT NULL as has_pdf,

    acd.export_xml_url IS NOT NULL as has_xml,

    jsonb_array_length(acd.medical_records)::INTEGER as total_records,

    acd.data_hash

  FROM archived_clinical_data acd

  WHERE acd.tenant_id = p_tenant_id

    AND (p_client_cpf IS NULL OR acd.client_cpf = p_client_cpf)

    AND (p_client_name IS NULL OR acd.client_name ILIKE '%' || p_client_name || '%')

  ORDER BY acd.archived_at DESC;

END;

$function$;