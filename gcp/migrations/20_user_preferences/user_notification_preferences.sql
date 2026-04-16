-- Table: user_notification_preferences
-- Domain: 20_user_preferences
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  appointment_cancelled BOOLEAN DEFAULT true NOT NULL,
  appointment_completed BOOLEAN DEFAULT true NOT NULL,
  appointment_created BOOLEAN DEFAULT true NOT NULL,
  commission_generated BOOLEAN DEFAULT true NOT NULL,
  commission_paid BOOLEAN DEFAULT true NOT NULL,
  goal_approved BOOLEAN DEFAULT true NOT NULL,
  goal_reached BOOLEAN DEFAULT true NOT NULL,
  goal_rejected BOOLEAN DEFAULT true NOT NULL,
  goal_reminder BOOLEAN DEFAULT true NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.user_notification_preferences ADD CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id);

ALTER TABLE public.user_notification_preferences ADD CONSTRAINT user_notification_preferences_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_notification_prefs_user ON public.user_notification_preferences USING btree (user_id);

CREATE INDEX idx_user_notif_prefs_user ON public.user_notification_preferences USING btree (user_id);
