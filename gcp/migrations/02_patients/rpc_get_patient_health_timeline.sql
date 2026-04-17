CREATE OR REPLACE FUNCTION public.get_patient_health_timeline(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, event_type text, event_date timestamp with time zone, title text, description text, professional_name text, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE v_client_id uuid; v_tenant_id uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id FROM public.patient_profiles pp WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  RETURN QUERY

  SELECT a.id, 'appointment'::text, a.scheduled_at, COALESCE(s.name,'Consulta')::text, COALESCE(a.notes,'')::text, COALESCE(p.full_name,'')::text, jsonb_build_object('status',a.status,'procedure_id',a.procedure_id)

  FROM public.appointments a LEFT JOIN public.procedures s ON s.id=a.procedure_id LEFT JOIN public.profiles p ON p.id=a.professional_id

  WHERE a.patient_id=v_client_id AND a.tenant_id=v_tenant_id AND a.status='completed'

  UNION ALL

  SELECT pr.id, 'prescription'::text, pr.created_at, ('Receita '||COALESCE(pr.prescription_type,'simples'))::text, LEFT(COALESCE(pr.medications,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('type',pr.prescription_type,'status',pr.status)

  FROM public.prescriptions pr LEFT JOIN public.profiles prof ON prof.id=pr.professional_id WHERE pr.patient_id=v_client_id AND pr.tenant_id=v_tenant_id

  UNION ALL

  SELECT er.id, 'exam'::text, er.created_at, COALESCE(er.exam_name,'Exame')::text, COALESCE(er.result_text,'')::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('status',er.status,'priority',er.priority)

  FROM public.exam_results er LEFT JOIN public.profiles prof ON prof.id=er.requested_by WHERE er.patient_id=v_client_id AND er.tenant_id=v_tenant_id

  UNION ALL

  SELECT mc.id, 'certificate'::text, mc.issued_at, CASE mc.certificate_type WHEN 'atestado' THEN 'Atestado M├®dico' WHEN 'declaracao_comparecimento' THEN 'Declara├º├úo de Comparecimento' WHEN 'laudo' THEN 'Laudo' WHEN 'relatorio' THEN 'Relat├│rio' ELSE 'Atestado' END::text, LEFT(COALESCE(mc.content,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('type',mc.certificate_type,'days_off',mc.days_off,'cid_code',mc.cid_code)

  FROM public.medical_certificates mc LEFT JOIN public.profiles prof ON prof.id=mc.professional_id WHERE mc.patient_id=v_client_id AND mc.tenant_id=v_tenant_id

  UNION ALL

  SELECT mr.id, 'medical_report'::text, mr.created_at, CASE mr.tipo WHEN 'medico' THEN 'Laudo M├®dico' WHEN 'pericial' THEN 'Laudo Pericial' WHEN 'aptidao' THEN 'Atestado de Aptid├úo' WHEN 'capacidade' THEN 'Laudo de Capacidade' WHEN 'complementar' THEN 'Laudo Complementar' WHEN 'psicologico' THEN 'Laudo Psicol├│gico' WHEN 'neuropsicologico' THEN 'Avalia├º├úo Neuropsicol├│gica' WHEN 'ocupacional' THEN 'Laudo Ocupacional' ELSE 'Laudo' END::text, LEFT(COALESCE(mr.conclusao,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('tipo',mr.tipo,'status',mr.status,'cid10',mr.cid10)

  FROM public.medical_reports mr LEFT JOIN public.profiles prof ON prof.id=mr.professional_id WHERE mr.patient_id=v_client_id AND mr.tenant_id=v_tenant_id AND mr.status IN ('finalizado','assinado')

  UNION ALL

  SELECT rf.id, 'referral'::text, rf.created_at, ('Encaminhamento ÔÇö '||COALESCE(sp.name,'Especialista'))::text, LEFT(COALESCE(rf.reason,''),200)::text, COALESCE(from_prof.full_name,'')::text, jsonb_build_object('status',rf.status,'priority',rf.priority)

  FROM public.referrals rf LEFT JOIN public.profiles from_prof ON from_prof.id=rf.from_professional LEFT JOIN public.specialties sp ON sp.id=rf.to_specialty_id WHERE rf.patient_id=v_client_id AND rf.tenant_id=v_tenant_id

  ORDER BY event_date DESC LIMIT p_limit;

END;

$function$;