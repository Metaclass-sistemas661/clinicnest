CREATE OR REPLACE FUNCTION public.export_lgpd_data_subject(p_tenant_id uuid, p_target_user_id uuid, p_format text DEFAULT 'json'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_requester_is_admin BOOLEAN := FALSE;

  v_target_profile_id UUID;



  v_profile JSONB;

  v_roles JSONB;

  v_notifications JSONB;

  v_preferences JSONB;

  v_lgpd_requests JSONB;

  v_goal_suggestions JSONB;

  v_appointments JSONB;

  v_commissions JSONB;

  v_salaries JSONB;

  v_audit_logs JSONB;

  v_payload JSONB;

BEGIN

  IF v_requester_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF lower(COALESCE(p_format, 'json')) NOT IN ('json', 'csv') THEN

    RAISE EXCEPTION 'Formato inv├ílido. Use json ou csv.';

  END IF;



  IF NOT EXISTS (

    SELECT 1

    FROM public.profiles p

    WHERE p.user_id = v_requester_user_id

      AND p.tenant_id = p_tenant_id

  ) THEN

    RAISE EXCEPTION 'Sem acesso ao tenant informado';

  END IF;



  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, p_tenant_id);



  IF NOT v_requester_is_admin AND v_requester_user_id <> p_target_user_id THEN

    RAISE EXCEPTION 'Acesso negado para exporta├º├úo de outro titular';

  END IF;



  SELECT p.id

  INTO v_target_profile_id

  FROM public.profiles p

  WHERE p.user_id = p_target_user_id

    AND p.tenant_id = p_tenant_id

  LIMIT 1;



  IF v_target_profile_id IS NULL THEN

    RAISE EXCEPTION 'Titular n├úo encontrado neste tenant';

  END IF;



  SELECT jsonb_build_object(

    'id', p.id,

    'user_id', p.user_id,

    'tenant_id', p.tenant_id,

    'full_name', p.full_name,

    'email', p.email,

    'phone', p.phone,

    'avatar_url', p.avatar_url,

    'created_at', p.created_at,

    'updated_at', p.updated_at

  )

  INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = p_target_user_id

    AND p.tenant_id = p_tenant_id

  LIMIT 1;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', ur.id,

        'role', ur.role,

        'tenant_id', ur.tenant_id,

        'created_at', ur.created_at

      )

      ORDER BY ur.created_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_roles

  FROM public.user_roles ur

  WHERE ur.user_id = p_target_user_id

    AND ur.tenant_id = p_tenant_id;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', n.id,

        'type', n.type,

        'title', n.title,

        'body', n.body,

        'metadata', n.metadata,

        'read_at', n.read_at,

        'created_at', n.created_at

      )

      ORDER BY n.created_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_notifications

  FROM public.notifications n

  WHERE n.tenant_id = p_tenant_id

    AND n.user_id = p_target_user_id;



  SELECT COALESCE(

    jsonb_build_object(

      'id', unp.id,

      'appointment_created', unp.appointment_created,

      'appointment_completed', unp.appointment_completed,

      'appointment_cancelled', unp.appointment_cancelled,

      'goal_approved', unp.goal_approved,

      'goal_rejected', unp.goal_rejected,

      'goal_reminder', unp.goal_reminder,

      'goal_reached', unp.goal_reached,

      'commission_paid', unp.commission_paid,

      'created_at', unp.created_at,

      'updated_at', unp.updated_at

    ),

    '{}'::jsonb

  )

  INTO v_preferences

  FROM public.user_notification_preferences unp

  WHERE unp.user_id = p_target_user_id

  LIMIT 1;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', r.id,

        'request_type', r.request_type,

        'request_details', r.request_details,

        'status', r.status,

        'requested_at', r.requested_at,

        'due_at', r.due_at,

        'resolved_at', r.resolved_at,

        'resolution_notes', r.resolution_notes

      )

      ORDER BY r.requested_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_lgpd_requests

  FROM public.lgpd_data_requests r

  WHERE r.tenant_id = p_tenant_id

    AND r.requester_user_id = p_target_user_id;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', gs.id,

        'name', gs.name,

        'goal_type', gs.goal_type,

        'target_value', gs.target_value,

        'period', gs.period,

        'status', gs.status,

        'rejection_reason', gs.rejection_reason,

        'created_at', gs.created_at,

        'reviewed_at', gs.reviewed_at

      )

      ORDER BY gs.created_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_goal_suggestions

  FROM public.goal_suggestions gs

  WHERE gs.tenant_id = p_tenant_id

    AND gs.professional_id = v_target_profile_id;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', a.id,

        'scheduled_at', a.scheduled_at,

        'duration_minutes', a.duration_minutes,

        'status', a.status,

        'price', a.price,

        'notes', a.notes,

        'created_at', a.created_at,

        'updated_at', a.updated_at

      )

      ORDER BY a.scheduled_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_appointments

  FROM public.appointments a

  WHERE a.tenant_id = p_tenant_id

    AND a.professional_id = v_target_profile_id;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', cp.id,

        'appointment_id', cp.appointment_id,

        'amount', cp.amount,

        'service_price', cp.service_price,

        'commission_type', cp.commission_type,

        'commission_value', cp.commission_value,

        'status', cp.status,

        'payment_date', cp.payment_date,

        'notes', cp.notes,

        'created_at', cp.created_at,

        'updated_at', cp.updated_at

      )

      ORDER BY cp.created_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_commissions

  FROM public.commission_payments cp

  WHERE cp.tenant_id = p_tenant_id

    AND cp.professional_id = p_target_user_id;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', sp.id,

        'payment_month', sp.payment_month,

        'payment_year', sp.payment_year,

        'amount', sp.amount,

        'days_worked', sp.days_worked,

        'days_in_month', sp.days_in_month,

        'status', sp.status,

        'payment_date', sp.payment_date,

        'payment_method', sp.payment_method,

        'payment_reference', sp.payment_reference,

        'notes', sp.notes,

        'created_at', sp.created_at,

        'updated_at', sp.updated_at

      )

      ORDER BY sp.payment_year DESC, sp.payment_month DESC, sp.created_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_salaries

  FROM public.salary_payments sp

  WHERE sp.tenant_id = p_tenant_id

    AND sp.professional_id = p_target_user_id;



  SELECT COALESCE(

    jsonb_agg(

      jsonb_build_object(

        'id', al.id,

        'action', al.action,

        'entity_type', al.entity_type,

        'entity_id', al.entity_id,

        'metadata', al.metadata,

        'created_at', al.created_at

      )

      ORDER BY al.created_at DESC

    ),

    '[]'::jsonb

  )

  INTO v_audit_logs

  FROM public.admin_audit_logs al

  WHERE al.tenant_id = p_tenant_id

    AND al.actor_user_id = p_target_user_id;



  v_payload := jsonb_build_object(

    'generated_at', now(),

    'format', lower(COALESCE(p_format, 'json')),

    'subject_user_id', p_target_user_id,

    'subject_profile', v_profile,

    'datasets', jsonb_build_object(

      'user_roles', v_roles,

      'notifications', v_notifications,

      'notification_preferences', v_preferences,

      'lgpd_requests', v_lgpd_requests,

      'goal_suggestions', v_goal_suggestions,

      'appointments', v_appointments,

      'commission_payments', v_commissions,

      'salary_payments', v_salaries,

      'admin_audit_logs', v_audit_logs

    )

  );



  IF v_requester_is_admin THEN

    PERFORM public.log_admin_action(

      p_tenant_id,

      'lgpd_data_exported',

      'profiles',

      p_target_user_id::text,

      jsonb_build_object(

        'requested_format', lower(COALESCE(p_format, 'json')),

        'target_user_id', p_target_user_id

      )

    );

  END IF;



  RETURN v_payload;

END;

$function$;