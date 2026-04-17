CREATE OR REPLACE FUNCTION public.get_client_dental_images(p_tenant_id uuid, p_client_id uuid, p_image_type text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, image_type text, file_name text, file_path text, file_size integer, mime_type text, tooth_numbers integer[], description text, clinical_notes text, rx_technique text, captured_at timestamp with time zone, professional_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  RETURN QUERY

  SELECT 

    di.id,

    di.image_type,

    di.file_name,

    di.file_path,

    di.file_size,

    di.mime_type,

    di.tooth_numbers,

    di.description,

    di.clinical_notes,

    di.rx_technique,

    di.captured_at,

    p.full_name AS professional_name

  FROM dental_images di

  LEFT JOIN profiles p ON di.professional_id = p.id

  WHERE di.tenant_id = p_tenant_id

    AND di.client_id = p_client_id

    AND (p_image_type IS NULL OR di.image_type = p_image_type)

  ORDER BY di.captured_at DESC;

END;

$function$;