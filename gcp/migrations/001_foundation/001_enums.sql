-- ============================================================
-- ClinicaFlow GCP Migration: Enums e Tipos Customizados
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
CREATE TYPE public.commission_type AS ENUM ('percentage', 'fixed');
