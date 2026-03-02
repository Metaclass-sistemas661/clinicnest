-- ============================================================================
-- SALES CHATBOT + LEADS — Chatbot IA de vendas via WhatsApp (landing page)
-- ============================================================================

-- 1) Conversas do chatbot de vendas (NÃO multi-tenant — é do ClinicNest)
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

CREATE INDEX IF NOT EXISTS idx_sales_conv_phone
  ON public.sales_chatbot_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_sales_conv_updated
  ON public.sales_chatbot_conversations(updated_at DESC);

ALTER TABLE public.sales_chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode acessar (edge function)
CREATE POLICY "Service role manages sales conversations"
  ON public.sales_chatbot_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) Mensagens do chatbot de vendas
CREATE TABLE IF NOT EXISTS public.sales_chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.sales_chatbot_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_msg_conv
  ON public.sales_chatbot_messages(conversation_id, created_at);

ALTER TABLE public.sales_chatbot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages sales messages"
  ON public.sales_chatbot_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) Leads capturados (WhatsApp, landing chat widget, formulários)
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

CREATE INDEX IF NOT EXISTS idx_sales_leads_status
  ON public.sales_leads(status);
CREATE INDEX IF NOT EXISTS idx_sales_leads_source
  ON public.sales_leads(source);
CREATE INDEX IF NOT EXISTS idx_sales_leads_created
  ON public.sales_leads(created_at DESC);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions)
CREATE POLICY "Service role manages sales leads"
  ON public.sales_leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users with admin role can see leads (for future admin panel)
CREATE POLICY "Admins can view sales leads"
  ON public.sales_leads FOR SELECT
  TO authenticated
  USING (true);

-- 4) Grants
GRANT ALL ON public.sales_chatbot_conversations TO service_role;
GRANT ALL ON public.sales_chatbot_messages TO service_role;
GRANT ALL ON public.sales_leads TO service_role;
GRANT SELECT ON public.sales_leads TO authenticated;
