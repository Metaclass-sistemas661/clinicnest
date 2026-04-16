-- Table: voucher_redemptions
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  voucher_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  discount_applied NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  order_id UUID,
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  redeemed_by UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.voucher_redemptions ADD CONSTRAINT voucher_redemptions_voucher_id_fkey
  FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id);

ALTER TABLE public.voucher_redemptions ADD CONSTRAINT voucher_redemptions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.voucher_redemptions ADD CONSTRAINT voucher_redemptions_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.voucher_redemptions ADD CONSTRAINT voucher_redemptions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.voucher_redemptions ADD CONSTRAINT voucher_redemptions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id);

ALTER TABLE public.voucher_redemptions ADD CONSTRAINT voucher_redemptions_redeemed_by_fkey
  FOREIGN KEY (redeemed_by) REFERENCES public.profiles(id);

CREATE INDEX idx_voucher_redemptions_vid ON public.voucher_redemptions USING btree (voucher_id);
