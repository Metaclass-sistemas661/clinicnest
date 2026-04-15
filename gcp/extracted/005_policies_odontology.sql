-- GCP Migration: RLS Policies - odontology
-- Total: 30 policies


-- ── Table: dental_images ──
ALTER TABLE public.dental_images ENABLE ROW LEVEL SECURITY;

-- Source: 20260325000000_dental_images_v1.sql
CREATE POLICY "dental_images_tenant_isolation" ON dental_images
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));


-- ── Table: dental_prescriptions ──
ALTER TABLE public.dental_prescriptions ENABLE ROW LEVEL SECURITY;

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE POLICY "dental_prescriptions_tenant_isolation" ON public.dental_prescriptions
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ── Table: odontogram_annotations ──
ALTER TABLE public.odontogram_annotations ENABLE ROW LEVEL SECURITY;

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE POLICY "odontogram_annotations_select" ON public.odontogram_annotations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE POLICY "odontogram_annotations_insert" ON public.odontogram_annotations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE POLICY "odontogram_annotations_delete" ON public.odontogram_annotations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND public.is_tenant_admin(auth.uid(), o.tenant_id)
    )
  );


-- ── Table: odontogram_teeth ──
ALTER TABLE public.odontogram_teeth ENABLE ROW LEVEL SECURITY;

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontogram_teeth_select" ON public.odontogram_teeth
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_clinical_professional(auth.uid())
        )
    )
  );

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontogram_teeth_insert" ON public.odontogram_teeth
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_dentist(auth.uid())
        )
    )
  );

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontogram_teeth_update" ON public.odontogram_teeth
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_dentist(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_dentist(auth.uid())
        )
    )
  );

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontogram_teeth_delete" ON public.odontogram_teeth
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND public.is_tenant_admin(auth.uid(), o.tenant_id)
    )
  );


-- ── Table: odontogram_tooth_history ──
ALTER TABLE public.odontogram_tooth_history ENABLE ROW LEVEL SECURITY;

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE POLICY "odontogram_tooth_history_select" ON public.odontogram_tooth_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE POLICY "odontogram_tooth_history_insert" ON public.odontogram_tooth_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontograms o
      WHERE o.id = odontogram_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.is_tenant_admin(auth.uid(), o.tenant_id)
          OR public.is_dentist(auth.uid())
        )
    )
  );


-- ── Table: odontogram_tooth_surfaces ──
ALTER TABLE public.odontogram_tooth_surfaces ENABLE ROW LEVEL SECURITY;

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE POLICY "odontogram_surfaces_select" ON public.odontogram_tooth_surfaces
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE POLICY "odontogram_surfaces_insert" ON public.odontogram_tooth_surfaces
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE POLICY "odontogram_surfaces_update" ON public.odontogram_tooth_surfaces
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND o.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), o.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE POLICY "odontogram_surfaces_delete" ON public.odontogram_tooth_surfaces
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.odontogram_teeth ot
      JOIN public.odontograms o ON o.id = ot.odontogram_id
      WHERE ot.id = odontogram_tooth_id
        AND public.is_tenant_admin(auth.uid(), o.tenant_id)
    )
  );


-- ── Table: odontograms ──
ALTER TABLE public.odontograms ENABLE ROW LEVEL SECURITY;

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontograms_select" ON public.odontograms
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontograms_insert" ON public.odontograms
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontograms_update" ON public.odontograms
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

-- Source: 20260325000001_odontograms_v1.sql
CREATE POLICY "odontograms_delete" ON public.odontograms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: periogram_measurements ──
ALTER TABLE public.periogram_measurements ENABLE ROW LEVEL SECURITY;

-- Source: 20260325100000_periograms_v1.sql
CREATE POLICY "periogram_measurements_access" ON periogram_measurements
  FOR ALL USING (
    periogram_id IN (
      SELECT id FROM periograms WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );


-- ── Table: periograms ──
ALTER TABLE public.periograms ENABLE ROW LEVEL SECURITY;

-- Source: 20260325100000_periograms_v1.sql
CREATE POLICY "periograms_tenant_isolation" ON periograms
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));


-- ── Table: treatment_plan_items ──
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plan_items_select" ON public.treatment_plan_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  );

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plan_items_insert" ON public.treatment_plan_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), p.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plan_items_update" ON public.treatment_plan_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND p.tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.is_tenant_admin(auth.uid(), p.tenant_id) OR public.is_dentist(auth.uid()))
    )
  );

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plan_items_delete" ON public.treatment_plan_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      WHERE p.id = plan_id
        AND public.is_tenant_admin(auth.uid(), p.tenant_id)
    )
  );


-- ── Table: treatment_plans ──
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plans_select" ON public.treatment_plans
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plans_insert" ON public.treatment_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plans_update" ON public.treatment_plans
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_dentist(auth.uid())
    )
  );

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE POLICY "treatment_plans_delete" ON public.treatment_plans
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: tuss_odonto_prices ──
ALTER TABLE public.tuss_odonto_prices ENABLE ROW LEVEL SECURITY;

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE POLICY "tuss_prices_tenant_isolation" ON public.tuss_odonto_prices
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

