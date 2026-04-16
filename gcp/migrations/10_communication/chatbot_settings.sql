-- Table: chatbot_settings
-- Domain: 10_communication
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.chatbot_settings (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  greeting_message TEXT,
  business_hours JSONB,
  auto_booking BOOLEAN DEFAULT false,
  ai_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  auto_confirm_booking BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT false NOT NULL,
  max_future_days INTEGER DEFAULT 30 NOT NULL,
  menu_message TEXT DEFAULT 'Escolha uma opção:' NOT NULL,
  business_days INTEGER[] DEFAULT '{1,2,3,4,5}' NOT NULL,
  outside_hours_message TEXT DEFAULT 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que retornaremos assim que possível.' NOT NULL,
  business_hours_end TIME DEFAULT '18:00:00' NOT NULL,
  business_hours_start TIME DEFAULT '08:00:00' NOT NULL,
  welcome_message TEXT DEFAULT 'Olá! Bem-vindo(a) à nossa clínica. Como posso ajudá-lo(a)?' NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.chatbot_settings ADD CONSTRAINT chatbot_settings_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.chatbot_settings ADD CONSTRAINT chatbot_settings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
