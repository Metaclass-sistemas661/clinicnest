-- GCP Migration: All Triggers
-- Total: 146 triggers


-- ── Table: accounts_receivable ──
-- Source: 20260330100000_financial_refactor_v1.sql
CREATE TRIGGER update_accounts_receivable_updated_at
    BEFORE UPDATE ON public.accounts_receivable
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: adverse_events ──
-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE TRIGGER trg_adverse_event_change
  BEFORE UPDATE ON adverse_events
  FOR EACH ROW EXECUTE FUNCTION log_adverse_event_change();


-- ── Table: after ──
-- Source: 20260201202318_6925414d-b7f8-431f-8ffe-99c3bc9b5bed.sql
CREATE TRIGGER trigger_create_income_on_completion
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.create_income_on_appointment_completion();

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE TRIGGER trg_notify_patient_prescription
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient();


-- ── Table: appointment_completion_summaries ──
-- Source: 20260310121000_audit_appointment_completion.sql
CREATE TRIGGER trg_audit_appointment_completion_summary_insert
AFTER INSERT ON public.appointment_completion_summaries
FOR EACH ROW
EXECUTE FUNCTION public.audit_appointment_completion_summary_insert();

-- Source: 20260310141000_write_guard_rpc_only.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_appointment_completion_summaries
BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_completion_summaries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: appointment_ratings ──
-- Source: 20260325100000_health_credits_engine.sql
CREATE TRIGGER trg_hc_rating_submitted
  AFTER INSERT ON public.appointment_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.hc_on_rating_submitted();


-- ── Table: appointments ──
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260203010000_add_commission_to_appointments.sql
CREATE TRIGGER trigger_calculate_commission_on_completed
    AFTER UPDATE OF status ON public.appointments
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
    EXECUTE FUNCTION public.calculate_commission_on_appointment_completed();

-- Source: 20260203010000_add_commission_to_appointments.sql
CREATE TRIGGER trigger_calculate_commission_on_insert
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION public.calculate_commission_on_appointment_insert();

-- Source: 20260216142000_phase3_cancel_appointment_rules.sql
create trigger trg_prevent_cancel_completed_appointments
before update of status on public.appointments
for each row
execute function public.prevent_cancel_completed_appointments();

-- Source: 20260628700000_consolidate_queue_system.sql
CREATE TRIGGER trg_auto_queue_on_checkin
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_queue_on_checkin();

-- Source: 20260628700000_consolidate_queue_system.sql
CREATE TRIGGER trg_auto_queue_on_checkin_insert
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_add_to_queue_on_checkin();

-- Source: 20260310141000_write_guard_rpc_only.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_appointments
BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
CREATE TRIGGER trg_appointments_create_nps_on_complete
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.create_nps_response_for_completed_appointment_v1();

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE TRIGGER trg_update_client_last_appointment
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_appointment();

-- Source: 20260324800000_return_automation_v1.sql
CREATE TRIGGER trg_check_return_on_appointment
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION check_return_on_appointment_complete();

-- Source: 20260325100000_health_credits_engine.sql
CREATE TRIGGER trg_hc_appointment_completed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.hc_on_appointment_completed();

-- Source: 20260327500000_tier_change_notification_v1.sql
CREATE TRIGGER trg_check_tier_on_appointment_complete
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_tier_on_appointment_complete();

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE TRIGGER trg_auto_submit_rnds
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_submit_to_rnds();

-- Source: 20260703800000_appointment_confirmed_notifications_v1.sql
CREATE TRIGGER trg_notify_patient_appointment_confirmed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.notify_patient_appointment_confirmed();

-- Source: 20260704500000_waitlist_auto_notify_on_cancel.sql
CREATE TRIGGER trg_notify_waitlist_on_cancel
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.notify_waitlist_on_cancellation();


-- ── Table: auth ──
-- Source: 20260202210000_handle_new_user_admin_trigger.sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ── Table: before ──
-- Source: 20260331000000_prescriptions_signature_fields_v1.sql
CREATE TRIGGER trg_protect_signed_prescription
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_signed_prescription();

-- Source: 20260703400000_rls_hardening_user_roles_v1.sql
CREATE TRIGGER trg_guard_user_roles_admin_promotion
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_roles_admin_promotion();


-- ── Table: bills_payable ──
-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create trigger trg_bills_payable_updated_at
  before update on public.bills_payable
  for each row execute function public.set_updated_at();


-- ── Table: bills_receivable ──
-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create trigger trg_bills_receivable_updated_at
  before update on public.bills_receivable
  for each row execute function public.set_updated_at();


-- ── Table: campaigns ──
-- Source: 20260312022000_campaigns_email_optout_v1.sql
create trigger update_campaigns_updated_at before update on public.campaigns
for each row execute function public.update_updated_at_column();


-- ── Table: chat_channels ──
-- Source: 20260330500000_chat_improvements_v1.sql
CREATE TRIGGER trg_chat_channels_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_chat_channels_updated_at();


-- ── Table: client_packages ──
-- Source: 20260312010000_crm_packages_v1.sql
create trigger update_client_packages_updated_at before update on public.client_packages
for each row execute function public.update_updated_at_column();


-- ── Table: clients ──
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260310143000_write_guard_extend_misc_tables.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_clients
BEFORE INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- Source: 20260322000000_patient_access_code_v1.sql
CREATE TRIGGER trg_generate_client_access_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_access_code();

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE TRIGGER trg_retention_block_clients
  BEFORE DELETE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION check_retention_before_delete();


-- ── Table: clinic_units ──
-- Source: 20260320130000_clinic_units.sql
CREATE TRIGGER update_clinic_units_updated_at
  BEFORE UPDATE ON public.clinic_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: clinical_evolutions ──
-- Source: 20260323300000_clinical_evolutions_soap_v1.sql
CREATE TRIGGER trg_clinical_evolutions_updated_at
  BEFORE UPDATE ON public.clinical_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260324700000_cfm_retention_policy_v1.sql
    CREATE TRIGGER trg_retention_block_clinical_evolutions
      BEFORE DELETE ON clinical_evolutions
      FOR EACH ROW
      EXECUTE FUNCTION check_retention_before_delete();

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE TRIGGER trg_clinical_evolutions_server_timestamp
  BEFORE INSERT ON public.clinical_evolutions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();


-- ── Table: commission_payments ──
-- Source: 20260224000000_fix_commission_system_lovable.sql
CREATE TRIGGER update_commission_payments_updated_at
  BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260203030000_create_expense_on_commission_paid.sql
CREATE TRIGGER trigger_create_expense_on_commission_paid
    AFTER UPDATE OF status ON public.commission_payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
    EXECUTE FUNCTION public.create_expense_on_commission_paid();

-- Source: 20260203030000_create_expense_on_commission_paid.sql
CREATE TRIGGER trigger_create_expense_on_commission_insert
    AFTER INSERT ON public.commission_payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid')
    EXECUTE FUNCTION public.create_expense_on_commission_insert();

-- Source: 20260310141000_write_guard_rpc_only.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_commission_payments
BEFORE INSERT OR UPDATE OR DELETE ON public.commission_payments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- Source: 20260327700000_financial_notifications_v1.sql
CREATE TRIGGER trg_notify_commission_generated
  AFTER INSERT ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_commission_generated();

-- Source: 20260327700000_financial_notifications_v1.sql
CREATE TRIGGER trg_notify_commission_paid
  AFTER UPDATE ON public.commission_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_commission_paid();


-- ── Table: commission_rules ──
-- Source: 20260327000000_commission_rules_v1.sql
CREATE TRIGGER update_commission_rules_updated_at 
    BEFORE UPDATE ON public.commission_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: contact_messages ──
-- Source: 20260316100000_security_compliance_rls.sql
CREATE TRIGGER trg_contact_rate_limit
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contact_rate_limit();


-- ── Table: cost_centers ──
-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create trigger trg_cost_centers_updated_at
  before update on public.cost_centers
  for each row execute function public.set_updated_at();


-- ── Table: dental_images ──
-- Source: 20260325000000_dental_images_v1.sql
CREATE TRIGGER set_dental_images_updated_at
  BEFORE UPDATE ON dental_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ── Table: exam_results ──
-- Source: 20260319110000_medical_tables_v1.sql
CREATE TRIGGER update_exam_results_updated_at
  BEFORE UPDATE ON public.exam_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE TRIGGER trg_notify_patient_exam
  AFTER INSERT ON public.exam_results
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient();


-- ── Table: financial_transactions ──
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260310141000_write_guard_rpc_only.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_financial_transactions
BEFORE INSERT OR UPDATE OR DELETE ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: goal_templates ──
-- Source: 20260310143000_write_guard_extend_misc_tables.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_goal_templates
BEFORE INSERT OR UPDATE OR DELETE ON public.goal_templates
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: goals ──
-- Source: 20260214000000_create_goals.sql
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260310143000_write_guard_extend_misc_tables.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_goals
BEFORE INSERT OR UPDATE OR DELETE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: hl7_connections ──
-- Source: 20260329300000_hl7_integration_v1.sql
CREATE TRIGGER trigger_hl7_connections_updated_at
    BEFORE UPDATE ON hl7_connections
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();


-- ── Table: hl7_patient_mapping ──
-- Source: 20260329300000_hl7_integration_v1.sql
CREATE TRIGGER trigger_hl7_patient_mapping_updated_at
    BEFORE UPDATE ON hl7_patient_mapping
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();


-- ── Table: insurance_plans ──
-- Source: 20260319110000_medical_tables_v1.sql
CREATE TRIGGER update_insurance_plans_updated_at
  BEFORE UPDATE ON public.insurance_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: lgpd_data_requests ──
-- Source: 20260304000000_lgpd_governance_phase2.sql
CREATE TRIGGER lgpd_data_requests_updated_at
  BEFORE UPDATE ON public.lgpd_data_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260305000000_lgpd_phase3_portability_anonymization_sla.sql
CREATE TRIGGER lgpd_data_requests_set_deadline
  BEFORE INSERT OR UPDATE OF requested_at, sla_days, due_at
  ON public.lgpd_data_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lgpd_data_request_deadline();


-- ── Table: lgpd_incidentes ──
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE TRIGGER trg_calcular_prazo_notificacao_anpd
  BEFORE INSERT OR UPDATE ON lgpd_incidentes
  FOR EACH ROW
  EXECUTE FUNCTION calcular_prazo_notificacao_anpd();


-- ── Table: lgpd_retention_policies ──
-- Source: 20260304000000_lgpd_governance_phase2.sql
CREATE TRIGGER lgpd_retention_policies_updated_at
  BEFORE UPDATE ON public.lgpd_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: lgpd_solicitacoes ──
-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE TRIGGER trg_calcular_prazo_lgpd
  BEFORE INSERT ON lgpd_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION calcular_prazo_lgpd();

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE TRIGGER trg_historico_solicitacao
  BEFORE UPDATE ON lgpd_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION registrar_historico_solicitacao();


-- ── Table: medical_certificates ──
-- Source: 20260321000000_patient_security_certificates_v1.sql
CREATE TRIGGER update_medical_certificates_updated_at
  BEFORE UPDATE ON public.medical_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE TRIGGER trg_notify_patient_certificate
  AFTER INSERT ON public.medical_certificates
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient();

-- Source: 20260330600000_certificate_digital_signature_v1.sql
CREATE TRIGGER trg_protect_signed_certificate
  BEFORE UPDATE ON public.medical_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_signed_certificate();

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE TRIGGER trg_medical_certificates_server_timestamp
  BEFORE INSERT ON public.medical_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();


-- ── Table: medical_records ──
-- Source: 20260319110000_medical_tables_v1.sql
CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE TRIGGER trg_retention_block_medical_records
  BEFORE DELETE ON medical_records
  FOR EACH ROW
  EXECUTE FUNCTION check_retention_before_delete();

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE TRIGGER trg_medical_records_server_timestamp
  BEFORE INSERT ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE TRIGGER trg_medical_records_attendance_number
  BEFORE INSERT ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_attendance_number();


-- ── Table: medical_reports ──
-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE TRIGGER update_medical_reports_updated_at
  BEFORE UPDATE ON public.medical_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: nfse_invoices ──
-- Source: 20260324700001_nfse_nfeio_integration_v1.sql
CREATE TRIGGER trigger_nfse_invoices_updated_at
  BEFORE UPDATE ON nfse_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_nfse_invoices_updated_at();


-- ── Table: nursing_evolutions ──
-- Source: 20260324700000_cfm_retention_policy_v1.sql
    CREATE TRIGGER trg_retention_block_nursing_evolutions
      BEFORE DELETE ON nursing_evolutions
      FOR EACH ROW
      EXECUTE FUNCTION check_retention_before_delete();


-- ── Table: odontogram_teeth ──
-- Source: 20260325000001_odontograms_v1.sql
CREATE TRIGGER trg_odontogram_teeth_updated_at
  BEFORE UPDATE ON public.odontogram_teeth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_odontogram_updated_at();

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE TRIGGER trg_odontogram_tooth_change
  AFTER UPDATE ON public.odontogram_teeth
  FOR EACH ROW
  EXECUTE FUNCTION public.log_odontogram_tooth_change();


-- ── Table: odontograms ──
-- Source: 20260325000001_odontograms_v1.sql
CREATE TRIGGER trg_odontograms_updated_at
  BEFORE UPDATE ON public.odontograms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_odontogram_updated_at();


-- ── Table: on ──
-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE TRIGGER trg_calc_periogram_cal
  BEFORE INSERT OR UPDATE OF probing_depth, recession ON public.periogram_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_periogram_cal();


-- ── Table: patient_consents ──
-- Source: 20260325180000_consent_patient_notifications.sql
CREATE TRIGGER trg_notify_patient_consent_insert
  AFTER INSERT ON public.patient_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_patient_consent();

-- Source: 20260325180000_consent_patient_notifications.sql
CREATE TRIGGER trg_notify_patient_consent_update
  AFTER UPDATE ON public.patient_consents
  FOR EACH ROW
  WHEN (OLD.signed_at IS NULL AND NEW.signed_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_patient_consent();

-- Source: 20260702000000_notification_system_v2.sql
CREATE TRIGGER trg_notify_consent_signed
  AFTER INSERT ON public.patient_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_consent_signed();


-- ── Table: patient_payments ──
-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE TRIGGER trg_payment_update_invoice
  AFTER INSERT ON public.patient_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_invoice_on_payment();


-- ── Table: patient_uploaded_exams ──
-- Source: 20260616000000_patient_exam_uploads_v1.sql
CREATE TRIGGER update_patient_uploaded_exams_updated_at
  BEFORE UPDATE ON public.patient_uploaded_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: periograms ──
-- Source: 20260325100000_periograms_v1.sql
CREATE TRIGGER set_periograms_updated_at
  BEFORE UPDATE ON periograms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ── Table: prescriptions ──
-- Source: 20260319110000_medical_tables_v1.sql
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE TRIGGER trg_prescriptions_server_timestamp
  BEFORE INSERT ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_server_timestamp();


-- ── Table: product_categories ──
-- Source: 20260310143000_write_guard_extend_misc_tables.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_product_categories
BEFORE INSERT OR UPDATE OR DELETE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: products ──
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260310143000_write_guard_extend_misc_tables.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_products
BEFORE INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: professional_commissions ──
-- Source: 20260208185449_3a4a49d3-841a-4e08-9aa3-fe2ea6698903.sql
CREATE TRIGGER update_professional_commissions_updated_at
  BEFORE UPDATE ON public.professional_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ── Table: profile_certificates ──
-- Source: 20260330700000_profile_certificates_v1.sql
CREATE TRIGGER trg_ensure_single_default_certificate
  BEFORE INSERT OR UPDATE ON public.profile_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_certificate();

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE TRIGGER trg_profile_certificates_updated_at
  BEFORE UPDATE ON public.profile_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ── Table: profiles ──
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: purchases ──
-- Source: 20260312030000_purchases_suppliers_avg_cost_v1.sql
create trigger update_purchases_updated_at before update on public.purchases
for each row execute function public.update_updated_at_column();


-- ── Table: push_subscriptions ──
-- Source: 20260324300000_push_notifications_v1.sql
CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();


-- ── Table: record_field_templates ──
-- Source: 20260320100000_record_templates.sql
CREATE TRIGGER update_record_field_templates_updated_at
  BEFORE UPDATE ON public.record_field_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: referrals ──
-- Source: 20260322600000_referrals_v1.sql
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: report_definitions ──
-- Source: 20260324100000_custom_reports_v1.sql
CREATE TRIGGER trigger_report_definitions_updated_at
  BEFORE UPDATE ON report_definitions
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();


-- ── Table: report_schedules ──
-- Source: 20260324100000_custom_reports_v1.sql
CREATE TRIGGER trigger_report_schedules_updated_at
  BEFORE UPDATE ON report_schedules
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();


-- ── Table: return_reminders ──
-- Source: 20260702000000_notification_system_v2.sql
CREATE TRIGGER trg_notify_return_scheduled
  AFTER INSERT ON public.return_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_return_scheduled();


-- ── Table: ripd_reports ──
-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TRIGGER trigger_ripd_reports_updated_at
  BEFORE UPDATE ON ripd_reports
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();


-- ── Table: role_templates ──
-- Source: 20260323400000_rbac_foundation_v1.sql
CREATE TRIGGER update_role_templates_updated_at
  BEFORE UPDATE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: salary_payments ──
-- Source: 20260225000000_add_salary_system.sql
CREATE TRIGGER update_salary_payments_updated_at
  BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260327700000_financial_notifications_v1.sql
CREATE TRIGGER trg_notify_salary_paid
  AFTER UPDATE ON public.salary_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_salary_paid();


-- ── Table: sbis_documentation ──
-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TRIGGER trigger_sbis_documentation_updated_at
  BEFORE UPDATE ON sbis_documentation
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();


-- ── Table: services ──
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260310143000_write_guard_extend_misc_tables.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_services
BEFORE INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: sngpc_agendamentos ──
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TRIGGER trigger_sngpc_agendamentos_updated_at
  BEFORE UPDATE ON sngpc_agendamentos
  FOR EACH ROW EXECUTE FUNCTION update_sngpc_transmissoes_updated_at();


-- ── Table: sngpc_credenciais ──
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TRIGGER trigger_sngpc_credenciais_updated_at
  BEFORE UPDATE ON sngpc_credenciais
  FOR EACH ROW EXECUTE FUNCTION update_sngpc_transmissoes_updated_at();


-- ── Table: sngpc_tracked_prescriptions ──
-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE TRIGGER sngpc_updated_at
  BEFORE UPDATE ON public.sngpc_tracked_prescriptions
  FOR EACH ROW EXECUTE FUNCTION trg_sngpc_updated_at();


-- ── Table: sngpc_transmissoes ──
-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TRIGGER trigger_sngpc_transmissoes_updated_at
  BEFORE UPDATE ON sngpc_transmissoes
  FOR EACH ROW EXECUTE FUNCTION update_sngpc_transmissoes_updated_at();

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE TRIGGER trigger_log_sngpc_transmissao
  AFTER UPDATE ON sngpc_transmissoes
  FOR EACH ROW EXECUTE FUNCTION log_sngpc_transmissao_change();


-- ── Table: specialties ──
-- Source: 20260319110000_medical_tables_v1.sql
CREATE TRIGGER update_specialties_updated_at
  BEFORE UPDATE ON public.specialties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: stock_movements ──
-- Source: 20260310141000_write_guard_rpc_only.sql
CREATE TRIGGER trg_enforce_rpc_only_writes_stock_movements
BEFORE INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();


-- ── Table: subscriptions ──
-- Source: 20260202130105_cec40232-09cf-4074-9d9b-2250932847c0.sql
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: suppliers ──
-- Source: 20260312030000_purchases_suppliers_avg_cost_v1.sql
create trigger update_suppliers_updated_at before update on public.suppliers
for each row execute function public.update_updated_at_column();


-- ── Table: support_messages ──
-- Source: 20260215170000_support_tickets.sql
CREATE TRIGGER trg_support_messages_enforce_tenant
BEFORE INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.support_messages_enforce_tenant_id();

-- Source: 20260215172000_audit_logs_core.sql
CREATE TRIGGER trg_audit_support_message_insert
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.audit_support_message_insert();


-- ── Table: support_tickets ──
-- Source: 20260215172000_audit_logs_core.sql
CREATE TRIGGER trg_audit_support_ticket_insert
AFTER INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.audit_support_ticket_insert();


-- ── Table: tenant_feature_overrides ──
-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE TRIGGER trigger_tenant_feature_overrides_updated_at
  BEFORE UPDATE ON tenant_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION update_override_updated_at();


-- ── Table: tenant_limit_overrides ──
-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE TRIGGER trigger_tenant_limit_overrides_updated_at
  BEFORE UPDATE ON tenant_limit_overrides
  FOR EACH ROW EXECUTE FUNCTION update_override_updated_at();


-- ── Table: tenant_theme_settings ──
-- Source: 20260329400000_ux_improvements_v1.sql
CREATE TRIGGER trigger_tenant_theme_updated_at
    BEFORE UPDATE ON tenant_theme_settings
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();


-- ── Table: tenants ──
-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE TRIGGER trg_seed_payment_methods
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_payment_methods_for_tenant();

-- Source: 20260304000000_lgpd_governance_phase2.sql
CREATE TRIGGER tenants_create_default_lgpd_retention_policy
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_lgpd_retention_policy();

-- Source: 20260323400000_rbac_foundation_v1.sql
CREATE TRIGGER trg_tenant_seed_role_templates
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.on_tenant_created_seed_templates();

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE TRIGGER trg_new_tenant_chat_channel
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_chat_channel();


-- ── Table: tiss_guides ──
-- Source: 20260330100000_financial_refactor_v1.sql
    CREATE TRIGGER trigger_create_receivable_on_tiss_approval
      AFTER UPDATE OF status ON public.tiss_guides
      FOR EACH ROW
      EXECUTE FUNCTION public.create_receivable_on_tiss_approval();


-- ── Table: treatment_plan_items ──
-- Source: 20260325100001_treatment_plans_v1.sql
CREATE TRIGGER trg_treatment_plan_items_updated_at
  BEFORE UPDATE ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_treatment_plan_updated_at();

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE TRIGGER trg_recalc_plan_totals_insert
  AFTER INSERT ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_treatment_plan_totals();

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE TRIGGER trg_recalc_plan_totals_update
  AFTER UPDATE OF total_price ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_treatment_plan_totals();

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE TRIGGER trg_recalc_plan_totals_delete
  AFTER DELETE ON public.treatment_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_treatment_plan_totals();


-- ── Table: treatment_plans ──
-- Source: 20260316500000_auto_consents_on_plan_approval.sql
CREATE TRIGGER trg_treatment_plan_approved_consents
  AFTER UPDATE ON public.treatment_plans
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado'))
  EXECUTE FUNCTION public.trg_auto_generate_consents_on_plan_approval();

-- Source: 20260316500000_auto_consents_on_plan_approval.sql
CREATE TRIGGER trg_treatment_plan_insert_approved_consents
  AFTER INSERT ON public.treatment_plans
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION public.trg_auto_generate_consents_on_plan_approval();

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE TRIGGER trg_treatment_plans_updated_at
  BEFORE UPDATE ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_treatment_plan_updated_at();

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE TRIGGER trg_set_plan_number
  BEFORE INSERT ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_number();


-- ── Table: triage_records ──
-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE TRIGGER trg_retention_block_triage_records
  BEFORE DELETE ON triage_records
  FOR EACH ROW
  EXECUTE FUNCTION check_retention_before_delete();

-- Source: 20260628700000_consolidate_queue_system.sql
CREATE TRIGGER trg_auto_update_queue_on_triage
  AFTER INSERT ON triage_records FOR EACH ROW EXECUTE FUNCTION auto_update_queue_on_triage();

-- Source: 20260628700000_consolidate_queue_system.sql
CREATE TRIGGER trg_auto_update_queue_on_triage_update
  AFTER UPDATE OF priority ON triage_records FOR EACH ROW EXECUTE FUNCTION auto_update_queue_on_triage();


-- ── Table: tsa_config ──
-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE TRIGGER trigger_tsa_config_updated_at
  BEFORE UPDATE ON tsa_config
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();


-- ── Table: user_keyboard_shortcuts ──
-- Source: 20260329400000_ux_improvements_v1.sql
CREATE TRIGGER trigger_user_shortcuts_updated_at
    BEFORE UPDATE ON user_keyboard_shortcuts
    FOR EACH ROW EXECUTE FUNCTION update_hl7_updated_at();


-- ── Table: user_notification_preferences ──
-- Source: 20260218000000_notifications.sql
CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: user_saved_reports ──
-- Source: 20260324100000_custom_reports_v1.sql
CREATE TRIGGER trigger_user_saved_reports_updated_at
  BEFORE UPDATE ON user_saved_reports
  FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();


-- ── Table: user_tour_progress ──
-- Source: 20260215173000_user_tours.sql
CREATE TRIGGER user_tour_progress_updated_at
  BEFORE UPDATE ON public.user_tour_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ── Table: waitlist ──
-- Source: 20260322700000_waitlist_v1.sql
CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

