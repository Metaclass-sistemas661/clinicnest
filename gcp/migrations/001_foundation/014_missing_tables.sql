-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (001_foundation)
-- 15 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE TABLE IF NOT EXISTS offline_cache_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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

ALTER TABLE public.offline_cache_metadata ENABLE ROW LEVEL SECURITY;

-- Source: 20260323400000_rbac_foundation_v1.sql
CREATE TABLE IF NOT EXISTS public.permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  resource TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, resource)
);

ALTER TABLE public.permission_overrides ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category report_category NOT NULL DEFAULT 'custom',
  
  -- Template ou customizado
  is_template BOOLEAN DEFAULT false,
  template_id UUID REFERENCES report_definitions(id),
  
  -- Configuração de dados
  base_table VARCHAR(100) NOT NULL,
  joins JSONB DEFAULT '[]',
  
  -- Campos selecionados
  fields JSONB NOT NULL DEFAULT '[]',
  
  -- Filtros padrão
  default_filters JSONB DEFAULT '[]',
  
  -- Agrupamentos
  group_by JSONB DEFAULT '[]',
  order_by JSONB DEFAULT '[]',
  
  -- Gráfico
  chart_type report_chart_type DEFAULT 'none',
  chart_config JSONB DEFAULT '{}',
  
  -- Metadados
  icon VARCHAR(50),
  color VARCHAR(20),
  
  -- Controle
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_by UUID,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Referência
  report_definition_id UUID REFERENCES report_definitions(id) ON DELETE SET NULL,
  saved_report_id UUID REFERENCES user_saved_reports(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
  
  -- Parâmetros usados
  filters_applied JSONB,
  
  -- Resultado
  row_count INTEGER,
  execution_time_ms INTEGER,
  
  -- Exportação
  export_format VARCHAR(10),
  file_url TEXT,
  file_size_bytes INTEGER,
  
  -- Status
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  
  -- Auditoria
  executed_by UUID,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Referência
  saved_report_id UUID NOT NULL REFERENCES user_saved_reports(id) ON DELETE CASCADE,
  
  -- Configuração de agendamento
  frequency report_schedule_frequency NOT NULL,
  day_of_week INTEGER, -- 0-6 para weekly
  day_of_month INTEGER, -- 1-31 para monthly
  time_of_day TIME DEFAULT '08:00',
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  
  -- Destinatários
  email_recipients TEXT[] NOT NULL,
  include_pdf BOOLEAN DEFAULT true,
  include_excel BOOLEAN DEFAULT false,
  include_csv BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

-- Source: 20260323400000_rbac_foundation_v1.sql
CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  professional_type public.professional_type NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, professional_type)
);

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  user_id       UUID NOT NULL,
  rpc_name      TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
  call_count    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, rpc_name, window_start)
);

ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  enabled_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE TABLE IF NOT EXISTS tenant_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  custom_value INTEGER NOT NULL,
  reason TEXT,
  enabled_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, limit_key)
);

ALTER TABLE public.tenant_limit_overrides ENABLE ROW LEVEL SECURITY;

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE TABLE IF NOT EXISTS public.tenant_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  attendance_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_sequences ENABLE ROW LEVEL SECURITY;

-- Source: 20260329400000_ux_improvements_v1.sql
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

ALTER TABLE public.tenant_theme_settings ENABLE ROW LEVEL SECURITY;

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE TABLE IF NOT EXISTS user_keyboard_shortcuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Shortcut info
    action_id TEXT NOT NULL, -- e.g., 'new_appointment', 'search', 'save'
    keys TEXT[] NOT NULL, -- e.g., ['Ctrl', 'N']
    
    -- Status
    is_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, action_id)
);

ALTER TABLE public.user_keyboard_shortcuts ENABLE ROW LEVEL SECURITY;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE TABLE IF NOT EXISTS user_saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Referência ao relatório
  report_definition_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  
  -- Customizações do usuário
  name VARCHAR(200) NOT NULL,
  custom_filters JSONB DEFAULT '[]',
  custom_fields JSONB,
  custom_group_by JSONB,
  custom_chart_config JSONB,
  
  -- Favorito
  is_favorite BOOLEAN DEFAULT false,
  
  -- Última execução
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_saved_reports ENABLE ROW LEVEL SECURITY;

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE TABLE IF NOT EXISTS user_video_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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

ALTER TABLE public.user_video_progress ENABLE ROW LEVEL SECURITY;

-- Source: 20260329400000_ux_improvements_v1.sql
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

ALTER TABLE public.video_tutorials ENABLE ROW LEVEL SECURITY;

