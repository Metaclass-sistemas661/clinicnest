-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (010_communications)
-- 6 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE TABLE IF NOT EXISTS public.chat_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_message_id UUID REFERENCES public.internal_messages(id) ON DELETE SET NULL,
  UNIQUE(profile_id, channel),
  UNIQUE(profile_id, channel_id)
);

ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

-- Source: 20260702000000_notification_system_v2.sql
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL DEFAULT 'patient',
  recipient_id UUID,
  channel TEXT NOT NULL,
  template_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Source: 20260324300000_push_notifications_v1.sql
CREATE TABLE IF NOT EXISTS push_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Destinatário
  user_id UUID,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  
  -- Conteúdo
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'clicked'
  error_message TEXT,
  
  -- Métricas
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

ALTER TABLE public.push_notifications_log ENABLE ROW LEVEL SECURITY;

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE TABLE IF NOT EXISTS public.sales_chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_clinic_size INT,
  context JSONB NOT NULL DEFAULT '{}',
  is_human_takeover BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE TABLE IF NOT EXISTS public.sales_chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.sales_chatbot_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_chatbot_messages ENABLE ROW LEVEL SECURITY;

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  email TEXT,
  name TEXT,
  clinic_size INT,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

