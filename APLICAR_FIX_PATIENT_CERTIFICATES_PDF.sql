-- ══════════════════════════════════════════════════════════════════════════════
-- FIX: get_patient_certificates() — incluir dados completos do tenant,
-- profissional e paciente para gerar PDF premium no portal do paciente
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_patient_certificates(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', mc.id,
        'tenant_id', mc.tenant_id,
        'certificate_type', mc.certificate_type,
        'issued_at', mc.issued_at,
        'days_off', mc.days_off,
        'start_date', mc.start_date,
        'end_date', mc.end_date,
        'cid_code', mc.cid_code,
        'content', mc.content,
        'notes', mc.notes,
        -- Profissional
        'professional_name', COALESCE(mc.signed_by_name, pr.full_name, ''),
        'professional_crm', COALESCE(mc.signed_by_crm, pr.council_number, ''),
        'professional_uf', COALESCE(mc.signed_by_uf, pr.council_state, ''),
        'professional_specialty', COALESCE(mc.signed_by_specialty, ''),
        -- Assinatura digital
        'digital_signature', mc.digital_signature,
        'signed_at', mc.signed_at,
        -- Clínica completa
        'clinic_name', COALESCE(t.name, ''),
        'clinic_address', COALESCE(t.address, ''),
        'clinic_phone', COALESCE(t.phone, ''),
        'clinic_cnpj', COALESCE(t.cnpj, ''),
        'clinic_email', COALESCE(t.email, ''),
        'logo_url', COALESCE(t.logo_url, ''),
        -- Paciente
        'patient_name', COALESCE(pt.name, ''),
        'patient_cpf', COALESCE(pt.cpf, ''),
        'patient_birth_date', pt.birth_date
      )
      FROM public.medical_certificates mc
      LEFT JOIN public.profiles pr ON pr.id = mc.professional_id
      LEFT JOIN public.tenants t ON t.id = mc.tenant_id
      LEFT JOIN public.patients pt ON pt.id = mc.patient_id
      WHERE mc.patient_id = v_link.client_id
        AND mc.tenant_id = v_link.tenant_id
      ORDER BY mc.issued_at DESC;
  END LOOP;
END;
$$;

-- Manter permissão
GRANT EXECUTE ON FUNCTION public.get_patient_certificates(uuid) TO authenticated;
