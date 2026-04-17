CREATE OR REPLACE FUNCTION public.notify_patient_multi_channel(p_tenant_id uuid, p_client_id uuid, p_trigger_type text, p_template_vars jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_prefs RECORD;

  v_result JSONB := '{"channels_queued": []}'::jsonb;

  v_rules RECORD;

  v_channels_queued TEXT[] := '{}';

BEGIN

  -- Get patient notification preferences (or defaults)

  SELECT 

    COALESCE(p.email_enabled, true) as email_enabled,

    COALESCE(p.sms_enabled, true) as sms_enabled,

    COALESCE(p.whatsapp_enabled, true) as whatsapp_enabled,

    COALESCE(p.opt_out_types, '{}') as opt_out_types

  INTO v_prefs

  FROM public.patient_notification_preferences p

  WHERE p.client_id = p_client_id AND p.tenant_id = p_tenant_id;



  -- If no preferences found, use all defaults (all enabled)

  IF NOT FOUND THEN

    v_prefs := ROW(true, true, true, '{}'::text[]);

  END IF;



  -- Check if patient opted out of this trigger type

  IF p_trigger_type = ANY(v_prefs.opt_out_types) THEN

    RETURN jsonb_build_object('skipped', true, 'reason', 'patient_opted_out');

  END IF;



  -- Find matching automation rules

  FOR v_rules IN

    SELECT id, channel, message_template

    FROM public.automations

    WHERE tenant_id = p_tenant_id

      AND trigger_type = p_trigger_type

      AND is_active = true

  LOOP

    -- Check if channel is enabled for this patient

    IF (v_rules.channel = 'email' AND v_prefs.email_enabled)

       OR (v_rules.channel = 'sms' AND v_prefs.sms_enabled)

       OR (v_rules.channel = 'whatsapp' AND v_prefs.whatsapp_enabled)

    THEN

      v_channels_queued := array_append(v_channels_queued, v_rules.channel);

    END IF;

  END LOOP;



  RETURN jsonb_build_object(

    'channels_queued', to_jsonb(v_channels_queued),

    'trigger_type', p_trigger_type,

    'client_id', p_client_id

  );

END;

$function$;