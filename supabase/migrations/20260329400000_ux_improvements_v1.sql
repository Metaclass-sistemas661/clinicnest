-- Migration: UX Improvements
-- Fase 39 - Melhorias de UX
-- Created: 2026-02-25

-- ============================================================================
-- TENANT THEME SETTINGS
-- Custom color themes per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_theme_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Primary color (HSL values)
    primary_h INTEGER DEFAULT 174 CHECK (primary_h >= 0 AND primary_h <= 360),
    primary_s INTEGER DEFAULT 72 CHECK (primary_s >= 0 AND primary_s <= 100),
    primary_l INTEGER DEFAULT 38 CHECK (primary_l >= 0 AND primary_l <= 100),
    
    -- Accent color (HSL values)
    accent_h INTEGER DEFAULT 210 CHECK (accent_h >= 0 AND accent_h <= 360),
    accent_s INTEGER DEFAULT 80 CHECK (accent_s >= 0 AND accent_s <= 100),
    accent_l INTEGER DEFAULT 55 CHECK (accent_l >= 0 AND accent_l <= 100),
    
    -- Preset name (for quick selection)
    preset_name TEXT DEFAULT 'teal',
    
    -- Custom logo URL
    logo_url TEXT,
    logo_dark_url TEXT,
    favicon_url TEXT,
    
    -- UI preferences
    border_radius TEXT DEFAULT '1rem' CHECK (border_radius IN ('0', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem')),
    font_family TEXT DEFAULT 'default' CHECK (font_family IN ('default', 'inter', 'roboto', 'poppins', 'nunito')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_tenant_theme_tenant ON tenant_theme_settings(tenant_id);

-- RLS
ALTER TABLE tenant_theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant theme"
    ON tenant_theme_settings FOR SELECT
    USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage tenant theme"
    ON tenant_theme_settings FOR ALL
    USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.is_tenant_admin(auth.uid(), tenant_id)
    )
    WITH CHECK (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND public.is_tenant_admin(auth.uid(), tenant_id)
    );


-- ============================================================================
-- VIDEO TUTORIALS TABLE
-- Embedded video tutorials for each feature
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Video info
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    
    -- Categorization
    category TEXT NOT NULL,
    feature_key TEXT, -- e.g., 'agenda', 'prontuario', 'financeiro'
    
    -- Ordering
    sort_order INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_video_tutorials_category ON video_tutorials(category);
CREATE INDEX IF NOT EXISTS idx_video_tutorials_feature ON video_tutorials(feature_key);
CREATE INDEX IF NOT EXISTS idx_video_tutorials_active ON video_tutorials(is_active) WHERE is_active = TRUE;

-- RLS (public read for all authenticated users)
ALTER TABLE video_tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tutorials"
    ON video_tutorials FOR SELECT
    TO authenticated
    USING (is_active = TRUE);


-- ============================================================================
-- USER VIDEO PROGRESS TABLE
-- Track which videos users have watched
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_video_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES video_tutorials(id) ON DELETE CASCADE,
    
    -- Progress
    watched_seconds INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    
    -- Timestamps
    last_watched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, video_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_video_progress_user ON user_video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_video ON user_video_progress(video_id);

-- RLS
ALTER TABLE user_video_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own video progress"
    ON user_video_progress FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own video progress"
    ON user_video_progress FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ============================================================================
-- OFFLINE CACHE METADATA TABLE
-- Track what data is cached for offline use
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_cache_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Cache info
    cache_key TEXT NOT NULL,
    data_type TEXT NOT NULL, -- 'appointments', 'patients', 'services', etc.
    record_count INTEGER DEFAULT 0,
    
    -- Sync info
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_version INTEGER DEFAULT 1,
    
    -- Size
    size_bytes INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, cache_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offline_cache_user ON offline_cache_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_cache_tenant ON offline_cache_metadata(tenant_id);

-- RLS
ALTER TABLE offline_cache_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache metadata"
    ON offline_cache_metadata FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own cache metadata"
    ON offline_cache_metadata FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ============================================================================
-- KEYBOARD SHORTCUTS CUSTOMIZATION
-- Allow users to customize keyboard shortcuts
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_keyboard_shortcuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Shortcut info
    action_id TEXT NOT NULL, -- e.g., 'new_appointment', 'search', 'save'
    keys TEXT[] NOT NULL, -- e.g., ['Ctrl', 'N']
    
    -- Status
    is_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, action_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_shortcuts_user ON user_keyboard_shortcuts(user_id);

-- RLS
ALTER TABLE user_keyboard_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shortcuts"
    ON user_keyboard_shortcuts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own shortcuts"
    ON user_keyboard_shortcuts FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ============================================================================
-- FUNCTION: Get tenant theme
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tenant_theme(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- ============================================================================
-- FUNCTION: Upsert tenant theme
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_tenant_theme(
    p_tenant_id UUID,
    p_primary_h INTEGER DEFAULT NULL,
    p_primary_s INTEGER DEFAULT NULL,
    p_primary_l INTEGER DEFAULT NULL,
    p_accent_h INTEGER DEFAULT NULL,
    p_accent_s INTEGER DEFAULT NULL,
    p_accent_l INTEGER DEFAULT NULL,
    p_preset_name TEXT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_logo_dark_url TEXT DEFAULT NULL,
    p_favicon_url TEXT DEFAULT NULL,
    p_border_radius TEXT DEFAULT NULL,
    p_font_family TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- ============================================================================
-- INSERT DEFAULT VIDEO TUTORIALS
-- ============================================================================

INSERT INTO video_tutorials (title, description, video_url, category, feature_key, sort_order) VALUES
    ('Bem-vindo ao ClinicaFlow', 'Visão geral do sistema e primeiros passos', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Começando', 'onboarding', 1),
    ('Configurando sua Clínica', 'Como configurar dados básicos, horários e profissionais', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Começando', 'configuracoes', 2),
    ('Criando Agendamentos', 'Aprenda a criar e gerenciar agendamentos', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Agenda', 'agenda', 3),
    ('Cadastro de Pacientes', 'Como cadastrar e gerenciar pacientes', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Pacientes', 'clientes', 4),
    ('Prontuário Eletrônico', 'Usando o prontuário SOAP e evoluções', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Clínico', 'prontuario', 5),
    ('Controle Financeiro', 'Gerenciando receitas, despesas e comissões', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Financeiro', 'financeiro', 6),
    ('Relatórios e Métricas', 'Analisando dados e tomando decisões', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Relatórios', 'relatorios', 7),
    ('Portal do Paciente', 'Como seus pacientes usam o portal', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'Portal', 'portal_paciente', 8)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================

CREATE TRIGGER trigger_tenant_theme_updated_at
    BEFORE UPDATE ON tenant_theme_settings
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();

CREATE TRIGGER trigger_user_shortcuts_updated_at
    BEFORE UPDATE ON user_keyboard_shortcuts
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tenant_theme_settings IS 'Custom color themes and branding per tenant';
COMMENT ON TABLE video_tutorials IS 'Embedded video tutorials for features';
COMMENT ON TABLE user_video_progress IS 'Track user progress on video tutorials';
COMMENT ON TABLE offline_cache_metadata IS 'Metadata for offline data caching';
COMMENT ON TABLE user_keyboard_shortcuts IS 'Custom keyboard shortcuts per user';
