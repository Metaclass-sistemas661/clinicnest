CREATE OR REPLACE FUNCTION public.upsert_tenant_theme(p_tenant_id uuid, p_primary_h integer DEFAULT NULL::integer, p_primary_s integer DEFAULT NULL::integer, p_primary_l integer DEFAULT NULL::integer, p_accent_h integer DEFAULT NULL::integer, p_accent_s integer DEFAULT NULL::integer, p_accent_l integer DEFAULT NULL::integer, p_preset_name text DEFAULT NULL::text, p_logo_url text DEFAULT NULL::text, p_logo_dark_url text DEFAULT NULL::text, p_favicon_url text DEFAULT NULL::text, p_border_radius text DEFAULT NULL::text, p_font_family text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

    v_id UUID;

BEGIN

    INSERT INTO tenant_theme_settings (

        tenant_id, primary_h, primary_s, primary_l,

        accent_h, accent_s, accent_l, preset_name,

        logo_url, logo_dark_url, favicon_url,

        border_radius, font_family

    ) VALUES (

        p_tenant_id,

        COALESCE(p_primary_h, 174),

        COALESCE(p_primary_s, 72),

        COALESCE(p_primary_l, 38),

        COALESCE(p_accent_h, 210),

        COALESCE(p_accent_s, 80),

        COALESCE(p_accent_l, 55),

        COALESCE(p_preset_name, 'teal'),

        p_logo_url,

        p_logo_dark_url,

        p_favicon_url,

        COALESCE(p_border_radius, '1rem'),

        COALESCE(p_font_family, 'default')

    )

    ON CONFLICT (tenant_id) DO UPDATE SET

        primary_h = COALESCE(p_primary_h, tenant_theme_settings.primary_h),

        primary_s = COALESCE(p_primary_s, tenant_theme_settings.primary_s),

        primary_l = COALESCE(p_primary_l, tenant_theme_settings.primary_l),

        accent_h = COALESCE(p_accent_h, tenant_theme_settings.accent_h),

        accent_s = COALESCE(p_accent_s, tenant_theme_settings.accent_s),

        accent_l = COALESCE(p_accent_l, tenant_theme_settings.accent_l),

        preset_name = COALESCE(p_preset_name, tenant_theme_settings.preset_name),

        logo_url = COALESCE(p_logo_url, tenant_theme_settings.logo_url),

        logo_dark_url = COALESCE(p_logo_dark_url, tenant_theme_settings.logo_dark_url),

        favicon_url = COALESCE(p_favicon_url, tenant_theme_settings.favicon_url),

        border_radius = COALESCE(p_border_radius, tenant_theme_settings.border_radius),

        font_family = COALESCE(p_font_family, tenant_theme_settings.font_family),

        updated_at = NOW()

    RETURNING id INTO v_id;

    

    RETURN v_id;

END;

$function$;