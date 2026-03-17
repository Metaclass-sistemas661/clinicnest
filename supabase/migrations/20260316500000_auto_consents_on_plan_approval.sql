-- =====================================================
-- Migration: Auto-geração de Contratos após Aprovação de Plano
-- Quando um treatment_plan muda para 'aprovado', gera automaticamente
-- registros em patient_consents para todos os consent_templates ativos 
-- do tenant que o paciente ainda não assinou.
-- =====================================================

BEGIN;

-- Função trigger: gera consents pendentes quando plano é aprovado
CREATE OR REPLACE FUNCTION public.trg_auto_generate_consents_on_plan_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_patient_user_id UUID;
BEGIN
  -- Só dispara quando status muda para 'aprovado'
  IF NEW.status <> 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = 'aprovado' THEN
    RETURN NEW; -- Já era aprovado, nada a fazer
  END IF;

  -- Buscar o user_id do paciente via patient_profiles
  SELECT pp.user_id INTO v_patient_user_id
  FROM public.patient_profiles pp
  WHERE pp.client_id = NEW.client_id
    AND pp.tenant_id = NEW.tenant_id
    AND pp.is_active = true
  LIMIT 1;

  -- Se paciente não tem conta no portal, não gera consents automáticos
  IF v_patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Para cada consent_template ativo e obrigatório do tenant 
  -- que o paciente ainda não assinou, criar um registro pendente
  FOR v_template IN
    SELECT ct.id, ct.title, ct.body_html, ct.tenant_id
    FROM public.consent_templates ct
    WHERE ct.tenant_id = NEW.tenant_id
      AND ct.is_active = true
      AND ct.is_required = true
      AND NOT EXISTS (
        SELECT 1 FROM public.patient_consents pc
        WHERE pc.client_id = NEW.client_id
          AND pc.template_id = ct.id
      )
  LOOP
    INSERT INTO public.patient_consents (
      tenant_id,
      client_id, 
      template_id,
      patient_user_id,
      template_snapshot_html,
      signed_at
    )
    VALUES (
      v_template.tenant_id,
      NEW.client_id,
      v_template.id,
      v_patient_user_id,
      v_template.body_html,
      NOW()
    )
    ON CONFLICT (client_id, template_id) DO NOTHING; -- Idempotente
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger no UPDATE de treatment_plans
DROP TRIGGER IF EXISTS trg_treatment_plan_approved_consents ON public.treatment_plans;
CREATE TRIGGER trg_treatment_plan_approved_consents
  AFTER UPDATE ON public.treatment_plans
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado'))
  EXECUTE FUNCTION public.trg_auto_generate_consents_on_plan_approval();

-- Também disparar em INSERT (caso o plano já seja criado como aprovado)
DROP TRIGGER IF EXISTS trg_treatment_plan_insert_approved_consents ON public.treatment_plans;
CREATE TRIGGER trg_treatment_plan_insert_approved_consents
  AFTER INSERT ON public.treatment_plans
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION public.trg_auto_generate_consents_on_plan_approval();

COMMIT;
