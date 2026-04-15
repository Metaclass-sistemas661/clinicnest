-- GCP Migration: RLS Policies - clinical
-- Total: 87 policies


-- ── Table: adverse_events ──
ALTER TABLE public.adverse_events ENABLE ROW LEVEL SECURITY;

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE POLICY "adverse_events_tenant_isolation" ON adverse_events
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));


-- ── Table: appointment_ratings ──
ALTER TABLE public.appointment_ratings ENABLE ROW LEVEL SECURITY;

-- Source: 20260326000000_patient_portal_scheduling_v1.sql
CREATE POLICY "appointment_ratings_patient_insert" ON public.appointment_ratings
  FOR INSERT TO authenticated
  WITH CHECK (patient_user_id = auth.uid());

-- Source: 20260326000000_patient_portal_scheduling_v1.sql
CREATE POLICY "appointment_ratings_patient_select" ON public.appointment_ratings
  FOR SELECT TO authenticated
  USING (patient_user_id = auth.uid());

-- Source: 20260326000000_patient_portal_scheduling_v1.sql
CREATE POLICY "appointment_ratings_tenant_select" ON public.appointment_ratings
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));


-- ── Table: clinic_rooms ──
ALTER TABLE public.clinic_rooms ENABLE ROW LEVEL SECURITY;

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "rooms_select" ON public.clinic_rooms
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "rooms_insert" ON public.clinic_rooms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "rooms_update" ON public.clinic_rooms
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "rooms_delete" ON public.clinic_rooms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: clinic_units ──
ALTER TABLE public.clinic_units ENABLE ROW LEVEL SECURITY;

-- Source: 20260320130000_clinic_units.sql
CREATE POLICY "units_select" ON public.clinic_units
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260320130000_clinic_units.sql
CREATE POLICY "units_insert" ON public.clinic_units
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Source: 20260320130000_clinic_units.sql
CREATE POLICY "units_update" ON public.clinic_units
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Source: 20260320130000_clinic_units.sql
CREATE POLICY "units_delete" ON public.clinic_units
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: clinical_evolutions ──
ALTER TABLE public.clinical_evolutions ENABLE ROW LEVEL SECURITY;

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "clinical_evolutions_select" ON public.clinical_evolutions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "clinical_evolutions_insert" ON public.clinical_evolutions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "clinical_evolutions_update" ON public.clinical_evolutions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260323300000_clinical_evolutions_soap_v1.sql
CREATE POLICY clinical_evolutions_delete ON public.clinical_evolutions
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
    AND professional_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );


-- ── Table: exam_results ──
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "exam_results_select" ON public.exam_results
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "exam_results_insert" ON public.exam_results
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "exam_results_update" ON public.exam_results
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "exam_results_delete" ON public.exam_results
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: insurance_plans ──
ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "insurance_plans_select" ON public.insurance_plans
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "insurance_plans_insert" ON public.insurance_plans
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "insurance_plans_update" ON public.insurance_plans
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "insurance_plans_delete" ON public.insurance_plans
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: medical_certificates ──
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "medical_certificates_select" ON public.medical_certificates
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "medical_certificates_insert" ON public.medical_certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_prescriber(auth.uid())
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "medical_certificates_update" ON public.medical_certificates
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260321000000_patient_security_certificates_v1.sql
CREATE POLICY "medical_certificates_delete" ON public.medical_certificates
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: medical_record_versions ──
ALTER TABLE public.medical_record_versions ENABLE ROW LEVEL SECURITY;

-- Source: 20260322500000_medical_records_digital_signature_v1.sql
CREATE POLICY "mrv_select" ON public.medical_record_versions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260322500000_medical_records_digital_signature_v1.sql
CREATE POLICY "mrv_insert" ON public.medical_record_versions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ── Table: medical_records ──
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "medical_records_select" ON public.medical_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "medical_records_insert" ON public.medical_records
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "medical_records_update" ON public.medical_records
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "medical_records_delete" ON public.medical_records
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: medical_reports ──
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "medical_reports_select" ON public.medical_reports
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "medical_reports_insert" ON public.medical_reports
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "medical_reports_update" ON public.medical_reports
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE POLICY "medical_reports_delete" ON public.medical_reports
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Source: 20260701000000_patient_portal_gaps_fix_v1.sql
CREATE POLICY "medical_reports_patient_select" ON public.medical_reports
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
    OR
    tenant_id = public.get_user_tenant_id(auth.uid())
  );


-- ── Table: nursing_evolutions ──
ALTER TABLE public.nursing_evolutions ENABLE ROW LEVEL SECURITY;

-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
CREATE POLICY "nursing_evo_select" ON public.nursing_evolutions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
CREATE POLICY "nursing_evo_insert" ON public.nursing_evolutions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND professional_type = 'enfermeiro'
        )
      )
    )
  );

-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
CREATE POLICY "nursing_evo_update" ON public.nursing_evolutions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND professional_type = 'enfermeiro'
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND professional_type = 'enfermeiro'
        )
      )
    )
  );

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "nursing_evo_delete" ON public.nursing_evolutions
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: patient_calls ──
ALTER TABLE public.patient_calls ENABLE ROW LEVEL SECURITY;

-- Source: 20260628700000_consolidate_queue_system.sql
  CREATE POLICY "patient_calls_tenant_isolation" ON patient_calls
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));


-- ── Table: pre_consultation_forms ──
ALTER TABLE public.pre_consultation_forms ENABLE ROW LEVEL SECURITY;

-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
CREATE POLICY pre_consultation_forms_tenant ON pre_consultation_forms
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ── Table: pre_consultation_responses ──
ALTER TABLE public.pre_consultation_responses ENABLE ROW LEVEL SECURITY;

-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
CREATE POLICY pre_consultation_responses_tenant ON pre_consultation_responses
  FOR ALL USING (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ── Table: prescriptions ──
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "prescriptions_select" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "prescriptions_insert" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_prescriber(auth.uid())
    )
  );

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE POLICY "prescriptions_update" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "prescriptions_delete" ON public.prescriptions
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: professional_working_hours ──
ALTER TABLE public.professional_working_hours ENABLE ROW LEVEL SECURITY;

-- Source: 20260311000000_agenda_availability_blocks_v1.sql
CREATE POLICY "pwh_tenant_read" ON public.professional_working_hours
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260311000000_agenda_availability_blocks_v1.sql
CREATE POLICY "pwh_service_write" ON public.professional_working_hours
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: profile_certificates ──
ALTER TABLE public.profile_certificates ENABLE ROW LEVEL SECURITY;

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE POLICY "profile_certificates_select" ON public.profile_certificates
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE POLICY "profile_certificates_insert" ON public.profile_certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE POLICY "profile_certificates_update" ON public.profile_certificates
  FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE POLICY "profile_certificates_delete" ON public.profile_certificates
  FOR DELETE TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );


-- ── Table: prontuario_exports ──
ALTER TABLE public.prontuario_exports ENABLE ROW LEVEL SECURITY;

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE POLICY "Tenant isolation for prontuario_exports" ON prontuario_exports
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));


-- ── Table: record_field_templates ──
ALTER TABLE public.record_field_templates ENABLE ROW LEVEL SECURITY;

-- Source: 20260320100000_record_templates.sql
CREATE POLICY "rft_select" ON public.record_field_templates
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260320100000_record_templates.sql
CREATE POLICY "rft_insert" ON public.record_field_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Source: 20260320100000_record_templates.sql
CREATE POLICY "rft_update" ON public.record_field_templates
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Source: 20260320100000_record_templates.sql
CREATE POLICY "rft_delete" ON public.record_field_templates
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: return_confirmation_tokens ──
ALTER TABLE public.return_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Source: 20260328600000_return_notification_v1.sql
CREATE POLICY "return_confirmation_tokens_tenant_access" ON return_confirmation_tokens
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Source: 20260328600000_return_notification_v1.sql
CREATE POLICY "return_confirmation_tokens_anon_select" ON return_confirmation_tokens
  FOR SELECT
  TO anon
  USING (true);


-- ── Table: return_reminders ──
ALTER TABLE public.return_reminders ENABLE ROW LEVEL SECURITY;

-- Source: 20260324800000_return_automation_v1.sql
CREATE POLICY "return_reminders_tenant_isolation" ON return_reminders
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));


-- ── Table: room_occupancies ──
ALTER TABLE public.room_occupancies ENABLE ROW LEVEL SECURITY;

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "room_occ_select" ON public.room_occupancies
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "room_occ_insert" ON public.room_occupancies
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "room_occ_update" ON public.room_occupancies
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE POLICY "room_occ_delete" ON public.room_occupancies
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: rooms ──
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "rooms_delete" ON public.rooms
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: schedule_blocks ──
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

-- Source: 20260311000000_agenda_availability_blocks_v1.sql
CREATE POLICY "sb_tenant_read" ON public.schedule_blocks
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260311000000_agenda_availability_blocks_v1.sql
CREATE POLICY "sb_service_write" ON public.schedule_blocks
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Table: specialties ──
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "specialties_select" ON public.specialties
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "specialties_insert" ON public.specialties
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "specialties_update" ON public.specialties
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "specialties_delete" ON public.specialties
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: triage_records ──
ALTER TABLE public.triage_records ENABLE ROW LEVEL SECURITY;

-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
CREATE POLICY "triage_records_select" ON public.triage_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
CREATE POLICY "triage_records_insert" ON public.triage_records
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_nursing_professional(auth.uid())
    )
  );

-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
CREATE POLICY "triage_records_update" ON public.triage_records
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_nursing_professional(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_nursing_professional(auth.uid())
    )
  );

-- Source: 20260319110000_medical_tables_v1.sql
CREATE POLICY "triage_records_delete" ON public.triage_records
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));


-- ── Table: waitlist ──
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Source: 20260322700000_waitlist_v1.sql
CREATE POLICY "waitlist_select" ON public.waitlist
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260322700000_waitlist_v1.sql
CREATE POLICY "waitlist_insert" ON public.waitlist
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260322700000_waitlist_v1.sql
CREATE POLICY "waitlist_update" ON public.waitlist
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Source: 20260322700000_waitlist_v1.sql
CREATE POLICY "waitlist_delete" ON public.waitlist
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));


-- ── Table: waitlist_notifications ──
ALTER TABLE public.waitlist_notifications ENABLE ROW LEVEL SECURITY;

-- Source: 20260704500000_waitlist_auto_notify_on_cancel.sql
CREATE POLICY waitlist_notifications_tenant_policy ON public.waitlist_notifications
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

