-- =============================================
-- APLICAR EM PRODUÇÃO: Supabase SQL Editor
-- FIX: RPCs de tratamento usam client_id mas coluna foi renomeada para patient_id
-- Erro: 42703 column p.client_id does not exist
-- =============================================

-- 1. get_client_treatment_plans
CREATE OR REPLACE FUNCTION public.get_client_treatment_plans(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  plan_number TEXT,
  title TEXT,
  status TEXT,
  total_value DECIMAL,
  final_value DECIMAL,
  items_count BIGINT,
  items_completed BIGINT,
  professional_name TEXT,
  created_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT 
    p.id,
    p.plan_number,
    p.title,
    p.status,
    p.total_value,
    p.final_value,
    (SELECT COUNT(*) FROM public.treatment_plan_items i WHERE i.plan_id = p.id) as items_count,
    (SELECT COUNT(*) FROM public.treatment_plan_items i WHERE i.plan_id = p.id AND i.status = 'concluido') as items_completed,
    pr.full_name as professional_name,
    p.created_at,
    p.approved_at
  FROM public.treatment_plans p
  LEFT JOIN public.profiles pr ON pr.id = p.professional_id
  WHERE p.tenant_id = p_tenant_id AND p.patient_id = p_client_id
  ORDER BY p.created_at DESC;
$$;

-- 2. get_treatment_plan_with_items
CREATE OR REPLACE FUNCTION public.get_treatment_plan_with_items(p_plan_id UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_plan JSON;
  v_items JSON;
BEGIN
  SELECT row_to_json(p) INTO v_plan
  FROM (
    SELECT 
      tp.*,
      c.name as client_name,
      c.cpf as client_cpf,
      pr.full_name as professional_name,
      pr.council_number,
      pr.council_state
    FROM public.treatment_plans tp
    LEFT JOIN public.clients c ON c.id = tp.patient_id
    LEFT JOIN public.profiles pr ON pr.id = tp.professional_id
    WHERE tp.id = p_plan_id
  ) p;
  
  SELECT COALESCE(json_agg(i ORDER BY i.sort_order, i.tooth_number), '[]'::JSON) INTO v_items
  FROM public.treatment_plan_items i
  WHERE i.plan_id = p_plan_id;
  
  RETURN json_build_object('plan', v_plan, 'items', v_items);
END;
$$;

-- Verificação rápida
SELECT 'OK: RPCs de treatment_plans corrigidas' as resultado;
