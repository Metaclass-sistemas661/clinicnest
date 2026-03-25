-- Atualiza get_patient_all_consents para retornar campos de foto/assinatura
-- necessários para exibição inline no portal do paciente
DROP FUNCTION IF EXISTS public.get_patient_all_consents(uuid);
CREATE OR REPLACE FUNCTION public.get_patient_all_consents(p_patient_id uuid)
RETURNS TABLE(
  template_id uuid,
  title text,
  body_html text,
  is_required boolean,
  template_type text,
  sort_order integer,
  consent_id uuid,
  signed_at timestamptz,
  signature_method text,
  sealed_pdf_path text,
  is_signed boolean,
  facial_photo_path text,
  manual_signature_path text,
  template_snapshot_html text,
  ip_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ct.id            AS template_id,
    ct.title,
    ct.body_html,
    ct.is_required,
    ct.template_type,
    ct.sort_order,
    pc.id            AS consent_id,
    pc.signed_at,
    pc.signature_method,
    pc.sealed_pdf_path,
    (pc.signed_at IS NOT NULL) AS is_signed,
    pc.facial_photo_path,
    pc.manual_signature_path,
    pc.template_snapshot_html,
    pc.ip_address
  FROM public.consent_templates ct
  JOIN public.patients c ON c.tenant_id = ct.tenant_id
  LEFT JOIN public.patient_consents pc
    ON pc.template_id = ct.id
    AND pc.patient_id = p_patient_id
  WHERE c.id = p_patient_id
    AND ct.is_active = true
  ORDER BY
    (pc.signed_at IS NULL) DESC,
    ct.is_required DESC,
    ct.sort_order,
    ct.created_at;
$$;
