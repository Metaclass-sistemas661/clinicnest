CREATE OR REPLACE FUNCTION public.get_patient_medical_reports(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_uid uuid := current_setting('app.current_user_id')::uuid;

  v_link record;

BEGIN

  IF v_uid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  FOR v_link IN

    SELECT pp.tenant_id, pp.client_id

    FROM public.patient_profiles pp

    WHERE pp.user_id = v_uid

      AND pp.is_active = true

      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)

  LOOP

    RETURN QUERY

      SELECT jsonb_build_object(

        'id', mr.id,

        'tenant_id', mr.tenant_id,

        'tipo', mr.tipo,

        'finalidade', mr.finalidade,

        'historia_clinica', mr.historia_clinica,

        'exame_fisico', mr.exame_fisico,

        'exames_complementares', mr.exames_complementares,

        'diagnostico', mr.diagnostico,

        'cid10', mr.cid10,

        'conclusao', mr.conclusao,

        'observacoes', mr.observacoes,

        'status', mr.status,

        'signed_at', mr.signed_at,

        'created_at', mr.created_at,

        'professional_name', COALESCE(pr.full_name, ''),

        'professional_council', COALESCE(pr.council_number, ''),

        'clinic_name', COALESCE(t.name, '')

      )

      FROM public.medical_reports mr

      LEFT JOIN public.profiles pr ON pr.id = mr.professional_id

      LEFT JOIN public.tenants t ON t.id = mr.tenant_id

      WHERE mr.patient_id = v_link.client_id

        AND mr.tenant_id = v_link.tenant_id

        AND mr.status IN ('finalizado', 'assinado')

      ORDER BY mr.created_at DESC;

  END LOOP;

END;

$function$;