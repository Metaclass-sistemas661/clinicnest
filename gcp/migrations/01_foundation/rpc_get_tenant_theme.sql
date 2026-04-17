CREATE OR REPLACE FUNCTION public.get_tenant_theme(p_tenant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

    v_theme JSON;

BEGIN

    SELECT json_build_object(

        'primary_h', COALESCE(primary_h, 174),

        'primary_s', COALESCE(primary_s, 72),

        'primary_l', COALESCE(primary_l, 38),

        'accent_h', COALESCE(accent_h, 210),

        'accent_s', COALESCE(accent_s, 80),

        'accent_l', COALESCE(accent_l, 55),

        'preset_name', COALESCE(preset_name, 'teal'),

        'logo_url', logo_url,

        'logo_dark_url', logo_dark_url,

        'favicon_url', favicon_url,

        'border_radius', COALESCE(border_radius, '1rem'),

        'font_family', COALESCE(font_family, 'default')

    ) INTO v_theme

    FROM tenant_theme_settings

    WHERE tenant_id = p_tenant_id;

    

    -- Return defaults if no custom theme

    IF v_theme IS NULL THEN

        v_theme := json_build_object(

            'primary_h', 174,

            'primary_s', 72,

            'primary_l', 38,

            'accent_h', 210,

            'accent_s', 80,

            'accent_l', 55,

            'preset_name', 'teal',

            'logo_url', NULL,

            'logo_dark_url', NULL,

            'favicon_url', NULL,

            'border_radius', '1rem',

            'font_family', 'default'

        );

    END IF;

    

    RETURN v_theme;

END;

$function$;