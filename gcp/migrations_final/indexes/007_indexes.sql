-- ============================================================
-- GCP Cloud SQL Migration - 007_indexes.sql
-- Execution Order: 022
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: All Indexes
-- Total: 571 indexes

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_clients_tenant_id ON public.clients(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_services_tenant_id ON public.services(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_appointments_status ON public.appointments(status);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_financial_transactions_tenant_id ON public.financial_transactions(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_stock_movements_tenant_id ON public.stock_movements(tenant_id);

-- Source: 20260201191658_045893e2-6004-4d68-a71d-356a05acd3af.sql
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);

-- Source: 20260202130105_cec40232-09cf-4074-9d9b-2250932847c0.sql
CREATE INDEX idx_subscriptions_tenant_id ON public.subscriptions(tenant_id);

-- Source: 20260202130105_cec40232-09cf-4074-9d9b-2250932847c0.sql
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);

-- Source: 20260202130105_cec40232-09cf-4074-9d9b-2250932847c0.sql
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- Source: 20260203000000_create_commissions.sql
CREATE INDEX IF NOT EXISTS idx_professional_commissions_user_tenant ON public.professional_commissions(user_id, tenant_id);

-- Source: 20260203000000_create_commissions.sql
CREATE INDEX IF NOT EXISTS idx_professional_commissions_tenant ON public.professional_commissions(tenant_id);

-- Source: 20260224000000_fix_commission_system_lovable.sql
CREATE INDEX IF NOT EXISTS idx_commission_payments_tenant ON public.commission_payments(tenant_id);

-- Source: 20260224000000_fix_commission_system_lovable.sql
CREATE INDEX IF NOT EXISTS idx_commission_payments_professional ON public.commission_payments(professional_id);

-- Source: 20260224000000_fix_commission_system_lovable.sql
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON public.commission_payments(status);

-- Source: 20260203000000_create_commissions.sql
CREATE INDEX IF NOT EXISTS idx_commission_payments_appointment ON public.commission_payments(appointment_id);

-- Source: 20260204000000_products_sale_price_and_financial_link.sql
CREATE INDEX IF NOT EXISTS idx_financial_transactions_product_id ON public.financial_transactions(product_id);

-- Source: 20260204010000_product_categories.sql
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant_id
  ON public.product_categories(tenant_id);

-- Source: 20260204010000_product_categories.sql
CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products(category_id);

-- Source: 20260224000000_fix_commission_system_lovable.sql
CREATE INDEX IF NOT EXISTS idx_commission_payments_created ON public.commission_payments(created_at);

-- Source: 20260213000000_appointment_completion_summaries.sql
CREATE INDEX IF NOT EXISTS idx_appointment_completion_summaries_tenant 
  ON public.appointment_completion_summaries(tenant_id);

-- Source: 20260213000000_appointment_completion_summaries.sql
CREATE INDEX IF NOT EXISTS idx_appointment_completion_summaries_created 
  ON public.appointment_completion_summaries(created_at);

-- Source: 20260214000000_create_goals.sql
CREATE INDEX IF NOT EXISTS idx_goals_tenant ON public.goals(tenant_id);

-- Source: 20260214000000_create_goals.sql
CREATE INDEX IF NOT EXISTS idx_goals_active ON public.goals(tenant_id, is_active) WHERE is_active = true;

-- Source: 20260214000100_stripe_webhook_events_alerting.sql
CREATE INDEX IF NOT EXISTS stripe_webhook_events_failed_unalerted_idx
    ON public.stripe_webhook_events (received_at)
    WHERE status = 'failed' AND alert_sent_at IS NULL;

-- Source: 20260214153000_asaas_webhook_events.sql
create index if not exists asaas_webhook_events_received_at_idx
  on public.asaas_webhook_events(received_at desc);

-- Source: 20260214153000_asaas_webhook_events.sql
create index if not exists asaas_webhook_events_status_idx
  on public.asaas_webhook_events(status);

-- Source: 20260214153000_asaas_webhook_events.sql
create index if not exists idx_subscriptions_asaas_customer_id
  on public.subscriptions(asaas_customer_id);

-- Source: 20260214153000_asaas_webhook_events.sql
create index if not exists idx_subscriptions_asaas_subscription_id
  on public.subscriptions(asaas_subscription_id);

-- Source: 20260214170000_tenants_billing_cpf_cnpj.sql
create index if not exists idx_tenants_billing_cpf_cnpj
  on public.tenants(billing_cpf_cnpj);

-- Source: 20260215000000_goals_enhancements.sql
CREATE INDEX IF NOT EXISTS idx_goal_templates_tenant ON public.goal_templates(tenant_id);

-- Source: 20260215000000_goals_enhancements.sql
CREATE INDEX IF NOT EXISTS idx_goal_achievements_tenant ON public.goal_achievements(tenant_id);

-- Source: 20260215000000_goals_enhancements.sql
CREATE INDEX IF NOT EXISTS idx_goal_achievements_goal ON public.goal_achievements(goal_id);

-- Source: 20260215000000_goals_enhancements.sql
CREATE INDEX IF NOT EXISTS idx_goal_achievements_professional ON public.goal_achievements(professional_id);

-- Source: 20260215030000_asaas_checkout_sessions.sql
CREATE INDEX IF NOT EXISTS asaas_checkout_sessions_tenant_id_idx
ON public.asaas_checkout_sessions(tenant_id);

-- Source: 20260215040000_asaas_webhook_alerts.sql
CREATE INDEX IF NOT EXISTS asaas_webhook_alerts_created_at_idx
ON public.asaas_webhook_alerts(created_at);

-- Source: 20260215040000_asaas_webhook_alerts.sql
CREATE INDEX IF NOT EXISTS asaas_webhook_alerts_event_type_idx
ON public.asaas_webhook_alerts(event_type);

-- Source: 20260215170000_support_tickets.sql
CREATE INDEX IF NOT EXISTS support_tickets_tenant_id_idx ON public.support_tickets (tenant_id);

-- Source: 20260215170000_support_tickets.sql
CREATE INDEX IF NOT EXISTS support_tickets_last_message_at_idx ON public.support_tickets (tenant_id, last_message_at DESC);

-- Source: 20260215170000_support_tickets.sql
CREATE INDEX IF NOT EXISTS support_messages_ticket_id_idx ON public.support_messages (ticket_id, created_at ASC);

-- Source: 20260215170000_support_tickets.sql
CREATE INDEX IF NOT EXISTS support_messages_tenant_id_idx ON public.support_messages (tenant_id, created_at DESC);

-- Source: 20260310145000_audit_logs_indexes.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at
  ON public.audit_logs (tenant_id, created_at DESC);

-- Source: 20260215172000_audit_logs_core.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_user_id, created_at DESC);

-- Source: 20260215173000_user_tours.sql
CREATE INDEX IF NOT EXISTS idx_user_tour_progress_tenant
  ON public.user_tour_progress (tenant_id, tour_key, updated_at DESC);

-- Source: 20260216123000_apply_subscription_update.sql
create index if not exists idx_subscriptions_last_billing_event_at
  on public.subscriptions(last_billing_event_at desc);

-- Source: 20260216124000_asaas_webhook_events_retry_alert.sql
create index if not exists asaas_webhook_events_next_retry_at_idx
  on public.asaas_webhook_events(next_retry_at);

-- Source: 20260216124000_asaas_webhook_events_retry_alert.sql
create index if not exists asaas_webhook_events_alert_sent_at_idx
  on public.asaas_webhook_events(alert_sent_at);

-- Source: 20260216134000_phase3_constraints_consistency.sql
create unique index if not exists commission_payments_appointment_id_unique
  on public.commission_payments(appointment_id)
  where appointment_id is not null;

-- Source: 20260216134000_phase3_constraints_consistency.sql
create unique index if not exists appointment_completion_summaries_appointment_id_unique
  on public.appointment_completion_summaries(appointment_id)
  where appointment_id is not null;

-- Source: 20260312056000_complete_appointment_on_conflict_unique_fix_v1.sql
create unique index if not exists financial_transactions_product_sale_unique
  on public.financial_transactions(appointment_id, product_id, type, category)
  where appointment_id is not null
    and product_id is not null
    and type = 'income'
    and category = 'Venda de Produto';

-- Source: 20260216141000_phase3_commission_paid_rpc.sql
create unique index if not exists financial_transactions_commission_payment_unique
  on public.financial_transactions(commission_payment_id)
  where commission_payment_id is not null;

-- Source: 20260217000000_goal_suggestions.sql
CREATE INDEX IF NOT EXISTS idx_goal_suggestions_tenant ON public.goal_suggestions(tenant_id);

-- Source: 20260217000000_goal_suggestions.sql
CREATE INDEX IF NOT EXISTS idx_goal_suggestions_professional ON public.goal_suggestions(professional_id);

-- Source: 20260217000000_goal_suggestions.sql
CREATE INDEX IF NOT EXISTS idx_goal_suggestions_status ON public.goal_suggestions(tenant_id, status);

-- Source: 20260218000000_notifications.sql
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- Source: 20260218000000_notifications.sql
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read_at);

-- Source: 20260218000000_notifications.sql
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(user_id, created_at DESC);

-- Source: 20260218000000_notifications.sql
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.user_notification_preferences(user_id);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON public.orders(tenant_id, created_at DESC);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON public.orders(tenant_id, status);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_orders_appointment ON public.orders(appointment_id);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON public.order_items(tenant_id);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);

-- Source: 20260218200000_orders_checkout_v1.sql
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);

-- Source: 20260218220000_cash_register_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_sessions_open_per_tenant
  ON public.cash_sessions(tenant_id)
  WHERE status = 'open';

-- Source: 20260218220000_cash_register_v1.sql
CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_created
  ON public.cash_sessions(tenant_id, created_at DESC);

-- Source: 20260218220000_cash_register_v1.sql
CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON public.cash_movements(session_id, created_at DESC);

-- Source: 20260218220000_cash_register_v1.sql
CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant
  ON public.cash_movements(tenant_id, created_at DESC);

-- Source: 20260219000001_appointments_confirmed_at_source.sql
CREATE INDEX IF NOT EXISTS idx_appointments_source
  ON public.appointments(tenant_id, source)
  WHERE source = 'online';

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant         ON vouchers(tenant_id);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_vouchers_code           ON vouchers(tenant_id, code);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_vouchers_status         ON vouchers(tenant_id, status);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_vid ON voucher_redemptions(voucher_id);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_discount_coupons_tenant ON discount_coupons(tenant_id);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_discount_coupons_code   ON discount_coupons(tenant_id, code);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_points_wallets_tenant   ON points_wallets(tenant_id);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_points_wallets_client   ON points_wallets(tenant_id, client_id);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_points_ledger_wallet    ON points_ledger(wallet_id);

-- Source: 20260219200000_phase3_vendas_fidelidade.sql
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_tenant    ON loyalty_tiers(tenant_id);

-- Source: 20260225000000_add_salary_system.sql
CREATE INDEX IF NOT EXISTS idx_salary_payments_tenant ON public.salary_payments(tenant_id);

-- Source: 20260225000000_add_salary_system.sql
CREATE INDEX IF NOT EXISTS idx_salary_payments_professional ON public.salary_payments(professional_id);

-- Source: 20260225000000_add_salary_system.sql
CREATE INDEX IF NOT EXISTS idx_salary_payments_status ON public.salary_payments(status);

-- Source: 20260225000000_add_salary_system.sql
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON public.salary_payments(payment_year, payment_month);

-- Source: 20260225000000_add_salary_system.sql
CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON public.salary_payments(payment_date);

-- Source: 20260225000000_add_salary_system.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_payments_unique_paid 
ON public.salary_payments(tenant_id, professional_id, payment_year, payment_month) 
WHERE status = 'paid';

-- Source: 20260227200000_ai_usage_log_update_features.sql
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_daily
  ON ai_usage_log(tenant_id, created_at DESC);

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE INDEX IF NOT EXISTS idx_product_usage_tenant ON public.product_usage(tenant_id);

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE INDEX IF NOT EXISTS idx_product_usage_product ON public.product_usage(product_id);

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE INDEX IF NOT EXISTS idx_product_usage_patient ON public.product_usage(patient_id);

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE INDEX IF NOT EXISTS idx_product_usage_appointment ON public.product_usage(appointment_id);

-- Source: 20260301000000_product_usage_and_batch.sql
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON public.stock_movements(batch_number) WHERE batch_number IS NOT NULL;

-- Source: 20260304000000_fix_odontogram_patient_id.sql
CREATE INDEX IF NOT EXISTS idx_odontograms_tenant_patient 
  ON public.odontograms(tenant_id, patient_id);

-- Source: 20260304000000_fix_odontogram_patient_id.sql
CREATE INDEX IF NOT EXISTS idx_odontograms_patient_date 
  ON public.odontograms(patient_id, exam_date DESC);

-- Source: 20260304000000_lgpd_governance_phase2.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_data_requests_tenant_status
  ON public.lgpd_data_requests (tenant_id, status, requested_at DESC);

-- Source: 20260304000000_lgpd_governance_phase2.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_data_requests_requester
  ON public.lgpd_data_requests (requester_user_id, requested_at DESC);

-- Source: 20260304000000_lgpd_governance_phase2.sql
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tenant_created_at
  ON public.admin_audit_logs (tenant_id, created_at DESC);

-- Source: 20260304000000_lgpd_governance_phase2.sql
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs (actor_user_id, created_at DESC);

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE INDEX IF NOT EXISTS idx_surface_tooth ON public.odontogram_tooth_surfaces(odontogram_tooth_id);

-- Source: 20260304000001_odontogram_v2_expansion.sql
CREATE INDEX IF NOT EXISTS idx_annotations_odontogram ON public.odontogram_annotations(odontogram_id);

-- Source: 20260305000000_lgpd_phase3_portability_anonymization_sla.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_data_requests_due_at
  ON public.lgpd_data_requests (tenant_id, due_at, status);

-- Source: 20260309000000_stripe_webhook_events.sql
create index if not exists stripe_webhook_events_type_idx on public.stripe_webhook_events(type);

-- Source: 20260309000000_stripe_webhook_events.sql
create index if not exists stripe_webhook_events_status_idx on public.stripe_webhook_events(status);

-- Source: 20260309000000_stripe_webhook_events.sql
create index if not exists stripe_webhook_events_received_at_idx on public.stripe_webhook_events(received_at desc);

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_scheduled_at
  ON public.appointments (tenant_id, scheduled_at);

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_professional_scheduled_at
  ON public.appointments (tenant_id, professional_id, scheduled_at);

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_professional_scheduled_at_not_cancelled
  ON public.appointments (tenant_id, professional_id, scheduled_at)
  WHERE status <> 'cancelled';

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_transaction_date
  ON public.financial_transactions (tenant_id, transaction_date DESC);

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_type_date
  ON public.financial_transactions (tenant_id, type, transaction_date DESC);

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created_at
  ON public.stock_movements (tenant_id, created_at DESC);

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product_created_at
  ON public.stock_movements (tenant_id, product_id, created_at DESC);

-- Source: 20260310140000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_out_reason_created_at
  ON public.stock_movements (tenant_id, out_reason_type, created_at DESC)
  WHERE movement_type = 'out';

-- Source: 20260310145000_audit_logs_indexes.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_created_at
  ON public.audit_logs (tenant_id, action, created_at DESC);

-- Source: 20260310145000_audit_logs_indexes.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity_created_at
  ON public.audit_logs (tenant_id, entity_type, created_at DESC);

-- Source: 20260311000000_agenda_availability_blocks_v1.sql
CREATE INDEX IF NOT EXISTS idx_pwh_tenant_prof
  ON public.professional_working_hours(tenant_id, professional_id);

-- Source: 20260311000000_agenda_availability_blocks_v1.sql
CREATE INDEX IF NOT EXISTS idx_sb_tenant_range
  ON public.schedule_blocks(tenant_id, start_at, end_at);

-- Source: 20260311000000_agenda_availability_blocks_v1.sql
CREATE INDEX IF NOT EXISTS idx_sb_prof_range
  ON public.schedule_blocks(professional_id, start_at, end_at);

-- Source: 20260312000000_online_booking_v1.sql
create unique index if not exists uq_tenants_online_booking_slug
  on public.tenants (lower(online_booking_slug))
  where online_booking_slug is not null;

-- Source: 20260312000000_online_booking_v1.sql
create unique index if not exists uq_appointments_public_booking_token
  on public.appointments(public_booking_token)
  where public_booking_token is not null;

-- Source: 20260312000000_online_booking_v1.sql
create index if not exists idx_appointments_created_via
  on public.appointments(created_via);

-- Source: 20260312010000_crm_packages_v1.sql
create index if not exists idx_client_packages_tenant_client
  on public.client_packages(tenant_id, client_id);

-- Source: 20260312010000_crm_packages_v1.sql
create index if not exists idx_client_packages_tenant_service
  on public.client_packages(tenant_id, service_id);

-- Source: 20260312010000_crm_packages_v1.sql
create index if not exists idx_client_packages_active_lookup
  on public.client_packages(tenant_id, client_id, service_id, status, remaining_sessions);

-- Source: 20260312010000_crm_packages_v1.sql
create index if not exists idx_client_package_ledger_pkg
  on public.client_package_ledger(package_id, created_at desc);

-- Source: 20260312010000_crm_packages_v1.sql
create index if not exists idx_appointment_package_consumptions_pkg
  on public.appointment_package_consumptions(package_id);

-- Source: 20260312020000_loyalty_cashback_v1.sql
create index if not exists idx_cashback_ledger_client
  on public.cashback_ledger(tenant_id, client_id, created_at desc);

-- Source: 20260312022000_campaigns_email_optout_v1.sql
create index if not exists idx_campaign_deliveries_campaign
  on public.campaign_deliveries(campaign_id, created_at desc);

-- Source: 20260312030000_purchases_suppliers_avg_cost_v1.sql
create index if not exists idx_suppliers_tenant_name
  on public.suppliers(tenant_id, name);

-- Source: 20260312030000_purchases_suppliers_avg_cost_v1.sql
create index if not exists idx_purchases_tenant_date
  on public.purchases(tenant_id, purchased_at desc);

-- Source: 20260312030000_purchases_suppliers_avg_cost_v1.sql
create index if not exists idx_purchase_items_purchase
  on public.purchase_items(purchase_id);

-- Source: 20260312031000_suppliers_crud_and_purchase_cancel_v1.sql
create index if not exists idx_purchase_items_purchase_product
  on public.purchase_items(purchase_id, product_id);

-- Source: 20260312031000_suppliers_crud_and_purchase_cancel_v1.sql
create index if not exists idx_purchases_tenant_status_date
  on public.purchases(tenant_id, status, purchased_at desc);

-- Source: 20260312040000_bi_cmv_snapshot_v1.sql
create index if not exists idx_order_items_tenant_kind_created
  on public.order_items(tenant_id, kind, created_at desc);

-- Source: 20260312050000_campaigns_robust_v1.sql
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign_status
  ON public.campaign_deliveries (campaign_id, status, created_at DESC);

-- Source: 20260312056000_complete_appointment_on_conflict_unique_fix_v1.sql
create unique index if not exists financial_transactions_service_income_unique
  on public.financial_transactions(appointment_id, type, category)
  where appointment_id is not null
    and product_id is null
    and type = 'income'
    and category = 'Serviço';

-- Source: 20260319002000_complete_appointment_on_conflict_hotfix_v2.sql
create unique index if not exists financial_transactions_service_income_unique_v2
  on public.financial_transactions(appointment_id, type, category)
  where appointment_id is not null
    and product_id is null;

-- Source: 20260319002000_complete_appointment_on_conflict_hotfix_v2.sql
create unique index if not exists financial_transactions_product_sale_unique_v2
  on public.financial_transactions(appointment_id, product_id, type, category)
  where appointment_id is not null
    and product_id is not null;

-- Source: 20260316100000_security_compliance_rls.sql
CREATE INDEX IF NOT EXISTS idx_contact_messages_email_created
  ON public.contact_messages (email, created_at DESC);

-- Source: 20260316200000_consent_sealed_architecture.sql
CREATE INDEX IF NOT EXISTS idx_patient_consents_signature_method
  ON public.patient_consents (signature_method)
  WHERE signature_method IS NOT NULL;

-- Source: 20260316200000_consent_sealed_architecture.sql
CREATE INDEX IF NOT EXISTS idx_patient_consents_sealed
  ON public.patient_consents (sealed_at)
  WHERE sealed_at IS NOT NULL;

-- Source: 20260316200000_consent_sealed_architecture.sql
CREATE INDEX IF NOT EXISTS idx_patient_consents_pending_seal
  ON public.patient_consents (signed_at)
  WHERE signed_at IS NOT NULL AND sealed_at IS NULL;

-- Source: 20260316200000_patient_proms.sql
CREATE INDEX IF NOT EXISTS idx_proms_patient ON public.patient_proms(patient_id, created_at DESC);

-- Source: 20260316200000_patient_proms.sql
CREATE INDEX IF NOT EXISTS idx_proms_tenant ON public.patient_proms(tenant_id, created_at DESC);

-- Source: 20260316200000_patient_proms.sql
CREATE INDEX IF NOT EXISTS idx_proms_severity ON public.patient_proms(tenant_id, severity) WHERE severity IN ('moderate', 'severe');

-- Source: 20260316300000_prescription_refill_requests.sql
CREATE INDEX IF NOT EXISTS idx_refill_patient ON public.prescription_refill_requests(patient_id, created_at DESC);

-- Source: 20260316300000_prescription_refill_requests.sql
CREATE INDEX IF NOT EXISTS idx_refill_tenant_status ON public.prescription_refill_requests(tenant_id, status) WHERE status = 'pending';

-- Source: 20260316400000_health_credits.sql
CREATE INDEX IF NOT EXISTS idx_health_credits_balance_tenant_patient
  ON public.health_credits_balance (tenant_id, patient_id);

-- Source: 20260316400000_health_credits.sql
CREATE INDEX IF NOT EXISTS idx_health_credits_transactions_patient
  ON public.health_credits_transactions (patient_id, created_at DESC);

-- Source: 20260316400000_health_credits.sql
CREATE INDEX IF NOT EXISTS idx_health_credits_transactions_tenant
  ON public.health_credits_transactions (tenant_id, created_at DESC);

-- Source: 20260316400000_health_credits.sql
CREATE INDEX IF NOT EXISTS idx_health_credits_rules_tenant
  ON public.health_credits_rules (tenant_id, is_active);

-- Source: 20260318200000_aesthetic_anamnesis_protocols.sql
CREATE INDEX IF NOT EXISTS idx_aesthetic_anamnesis_patient ON aesthetic_anamnesis(tenant_id, patient_id);

-- Source: 20260318200000_aesthetic_anamnesis_protocols.sql
CREATE INDEX IF NOT EXISTS idx_aesthetic_protocols_patient ON aesthetic_protocols(tenant_id, patient_id);

-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
create index if not exists idx_automations_tenant_active
  on public.automations(tenant_id, is_active);

-- Source: 20260319000001_automation_dispatch_period_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_dispatch_v2
  ON public.automation_dispatch_logs(automation_id, entity_type, entity_id, dispatch_period);

-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
create index if not exists idx_automation_dispatch_tenant_created
  on public.automation_dispatch_logs(tenant_id, created_at desc);

-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
create index if not exists idx_nps_responses_tenant_created
  on public.nps_responses(tenant_id, created_at desc);

-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
create index if not exists idx_nps_responses_appointment
  on public.nps_responses(appointment_id);

-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
create unique index uq_nps_responses_appointment on public.nps_responses(appointment_id) where appointment_id is not null';

-- Source: 20260319003000_complete_appointment_on_conflict_hotfix_v3.sql
create unique index if not exists commission_payments_appointment_id_unique_v2
  on public.commission_payments(appointment_id)
  where appointment_id is not null;

-- Source: 20260319003000_complete_appointment_on_conflict_hotfix_v3.sql
create unique index if not exists appointment_completion_summaries_appointment_id_unique_v2
  on public.appointment_completion_summaries(appointment_id)
  where appointment_id is not null;

-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create index if not exists idx_cost_centers_tenant
  on public.cost_centers(tenant_id);

-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create index if not exists idx_bills_payable_tenant_due
  on public.bills_payable(tenant_id, due_date);

-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create index if not exists idx_bills_payable_tenant_status
  on public.bills_payable(tenant_id, status);

-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create index if not exists idx_bills_receivable_tenant_due
  on public.bills_receivable(tenant_id, due_date);

-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
create index if not exists idx_bills_receivable_tenant_status
  on public.bills_receivable(tenant_id, status);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_records_client      ON public.medical_records(client_id);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_records_tenant_date ON public.medical_records(tenant_id, record_date DESC);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_triage_records_client ON public.triage_records(client_id);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_triage_records_tenant ON public.triage_records(tenant_id, triaged_at DESC);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_prescriptions_client ON public.prescriptions(client_id);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant  ON public.prescriptions(tenant_id, issued_at DESC);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_exam_results_client        ON public.exam_results(client_id);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_exam_results_tenant_status ON public.exam_results(tenant_id, status);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_clients_cpf                    ON public.clients(tenant_id, cpf);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_clients_insurance              ON public.clients(insurance_plan_id);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_appointments_specialty         ON public.appointments(specialty_id);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_appointments_consultation_type ON public.appointments(tenant_id, consultation_type);

-- Source: 20260319110000_medical_tables_v1.sql
CREATE INDEX IF NOT EXISTS idx_services_specialty             ON public.services(specialty_id);

-- Source: 20260320000000_patient_portal_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON public.patient_profiles(user_id);

-- Source: 20260320000000_patient_portal_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_profiles_tenant_client ON public.patient_profiles(tenant_id, client_id);

-- Source: 20260320100000_record_templates.sql
CREATE INDEX IF NOT EXISTS idx_rft_tenant_id     ON public.record_field_templates (tenant_id);

-- Source: 20260320100000_record_templates.sql
CREATE INDEX IF NOT EXISTS idx_rft_specialty_id  ON public.record_field_templates (specialty_id);

-- Source: 20260320100001_telemedicine_public_token_v1.sql
CREATE INDEX IF NOT EXISTS idx_appointments_telemedicine_token
  ON public.appointments(telemedicine_token) WHERE telemedicine_token IS NOT NULL;

-- Source: 20260320110000_tiss_guides.sql
CREATE INDEX IF NOT EXISTS idx_tiss_guides_tenant_id         ON public.tiss_guides (tenant_id);

-- Source: 20260320110000_tiss_guides.sql
CREATE INDEX IF NOT EXISTS idx_tiss_guides_insurance_plan_id ON public.tiss_guides (insurance_plan_id);

-- Source: 20260320110000_tiss_guides.sql
CREATE INDEX IF NOT EXISTS idx_tiss_guides_lot_number        ON public.tiss_guides (tenant_id, lot_number);

-- Source: 20260320110000_tiss_guides.sql
CREATE INDEX IF NOT EXISTS idx_tiss_guides_status            ON public.tiss_guides (tenant_id, status);

-- Source: 20260320110000_tiss_guides.sql
CREATE INDEX IF NOT EXISTS idx_tiss_guides_appointment_id    ON public.tiss_guides (appointment_id);

-- Source: 20260320120000_internal_chat.sql
CREATE INDEX IF NOT EXISTS idx_internal_messages_tenant_channel
  ON public.internal_messages (tenant_id, channel, created_at DESC);

-- Source: 20260320120000_internal_chat.sql
CREATE INDEX IF NOT EXISTS idx_internal_messages_sender
  ON public.internal_messages (sender_id);

-- Source: 20260320130000_clinic_units.sql
CREATE INDEX IF NOT EXISTS idx_clinic_units_tenant_id ON public.clinic_units (tenant_id);

-- Source: 20260320130000_clinic_units.sql
CREATE INDEX IF NOT EXISTS idx_appointments_unit_id ON public.appointments (unit_id);

-- Source: 20260321000000_patient_security_certificates_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_certificates_client ON public.medical_certificates(client_id);

-- Source: 20260321000000_patient_security_certificates_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_certificates_tenant ON public.medical_certificates(tenant_id, issued_at DESC);

-- Source: 20260322000000_patient_access_code_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_access_code ON public.clients(access_code);

-- Source: 20260322000000_patient_access_code_v1.sql
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_notif_user
  ON public.patient_notifications(user_id, created_at DESC);

-- Source: 20260322200001_patient_notifications_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_notif_unread
  ON public.patient_notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- Source: 20260322210000_consent_system_v1.sql
CREATE INDEX IF NOT EXISTS idx_consent_templates_tenant ON public.consent_templates(tenant_id);

-- Source: 20260322210000_consent_system_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_consents_client ON public.patient_consents(client_id);

-- Source: 20260322210000_consent_system_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_consents_template ON public.patient_consents(template_id);

-- Source: 20260322210000_consent_system_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_consents_tenant ON public.patient_consents(tenant_id);

-- Source: 20260322300000_triage_prontuario_link_v1.sql
CREATE INDEX IF NOT EXISTS idx_triage_records_status
  ON public.triage_records(tenant_id, status, triaged_at DESC);

-- Source: 20260322300000_triage_prontuario_link_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_records_triage
  ON public.medical_records(triage_id);

-- Source: 20260322300000_triage_prontuario_link_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_records_template
  ON public.medical_records(template_id);

-- Source: 20260322500000_medical_records_digital_signature_v1.sql
CREATE INDEX IF NOT EXISTS idx_mrv_record ON public.medical_record_versions(record_id, version_number DESC);

-- Source: 20260322600000_referrals_v1.sql
CREATE INDEX IF NOT EXISTS idx_referrals_tenant ON public.referrals(tenant_id, created_at DESC);

-- Source: 20260322600000_referrals_v1.sql
CREATE INDEX IF NOT EXISTS idx_referrals_from ON public.referrals(from_professional, status);

-- Source: 20260322600000_referrals_v1.sql
CREATE INDEX IF NOT EXISTS idx_referrals_to ON public.referrals(to_professional, status);

-- Source: 20260322600000_referrals_v1.sql
CREATE INDEX IF NOT EXISTS idx_referrals_client ON public.referrals(client_id);

-- Source: 20260322700000_waitlist_v1.sql
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON public.waitlist(tenant_id, status, created_at);

-- Source: 20260322700000_waitlist_v1.sql
CREATE INDEX IF NOT EXISTS idx_waitlist_client ON public.waitlist(client_id);

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE INDEX IF NOT EXISTS idx_glosa_appeals_tenant   ON public.tiss_glosa_appeals (tenant_id);

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE INDEX IF NOT EXISTS idx_glosa_appeals_guide    ON public.tiss_glosa_appeals (tiss_guide_id);

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE INDEX IF NOT EXISTS idx_glosa_appeals_status   ON public.tiss_glosa_appeals (tenant_id, status);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_nursing_evo_tenant    ON public.nursing_evolutions (tenant_id);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_nursing_evo_client    ON public.nursing_evolutions (client_id);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_nursing_evo_prof      ON public.nursing_evolutions (professional_id);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_nursing_evo_date      ON public.nursing_evolutions (tenant_id, evolution_date DESC);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_clinic_rooms_tenant ON public.clinic_rooms (tenant_id);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_clinic_rooms_unit   ON public.clinic_rooms (unit_id);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_room_occ_tenant ON public.room_occupancies (tenant_id);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_room_occ_room   ON public.room_occupancies (room_id);

-- Source: 20260323000000_nursing_evolutions_rooms_v1.sql
CREATE INDEX IF NOT EXISTS idx_room_occ_active ON public.room_occupancies (tenant_id, status) WHERE status = 'occupied';

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_prescriptions_medical_record ON public.prescriptions(medical_record_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON public.prescriptions(appointment_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_certificates_medical_record ON public.medical_certificates(medical_record_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_certificates_appointment ON public.medical_certificates(appointment_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_exam_results_medical_record ON public.exam_results(medical_record_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_exam_results_appointment ON public.exam_results(appointment_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_referrals_medical_record ON public.referrals(medical_record_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_referrals_appointment ON public.referrals(appointment_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_nursing_evo_medical_record ON public.nursing_evolutions(medical_record_id);

-- Source: 20260323100000_clinical_flow_coherence_v1.sql
CREATE INDEX IF NOT EXISTS idx_nursing_evo_appointment ON public.nursing_evolutions(appointment_id);

-- Source: 20260323300000_clinical_evolutions_soap_v1.sql
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_tenant
  ON public.clinical_evolutions(tenant_id, evolution_date DESC);

-- Source: 20260323300000_clinical_evolutions_soap_v1.sql
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_client
  ON public.clinical_evolutions(client_id, evolution_date DESC);

-- Source: 20260323300000_clinical_evolutions_soap_v1.sql
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_professional
  ON public.clinical_evolutions(professional_id, evolution_date DESC);

-- Source: 20260323300000_clinical_evolutions_soap_v1.sql
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_appointment
  ON public.clinical_evolutions(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Source: 20260323400000_rbac_foundation_v1.sql
CREATE INDEX IF NOT EXISTS idx_profiles_professional_type
  ON public.profiles (tenant_id, professional_type);

-- Source: 20260323400000_rbac_foundation_v1.sql
CREATE INDEX IF NOT EXISTS idx_permission_overrides_user
  ON public.permission_overrides (tenant_id, user_id);

-- Source: 20260323500000_rbac_rls_enforcement_v1.sql
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_professional_type
  ON public.profiles (user_id, professional_type);

-- Source: 20260323700000_clinical_access_audit_v1.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinical_action
  ON public.audit_logs (tenant_id, action, created_at DESC)
  WHERE action IN ('clinical_access', 'access_denied');

-- Source: 20260323700000_clinical_access_audit_v1.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_flagged
  ON public.audit_logs (tenant_id, created_at DESC)
  WHERE action = 'clinical_access' AND (metadata->>'is_flagged')::boolean = true;

-- Source: 20260323800000_rbac_refinements_v1.sql
CREATE INDEX IF NOT EXISTS idx_permission_overrides_unit
  ON public.permission_overrides (tenant_id, user_id, unit_id);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_tenant ON sngpc_estoque(tenant_id);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_medicamento ON sngpc_estoque(medicamento_codigo);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_lista ON sngpc_estoque(lista);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_lote ON sngpc_estoque(lote);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_validade ON sngpc_estoque(data_validade);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_tenant ON sngpc_movimentacoes(tenant_id);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_estoque ON sngpc_movimentacoes(estoque_id);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_tipo ON sngpc_movimentacoes(tipo_movimentacao);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_data ON sngpc_movimentacoes(data_movimentacao);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_paciente ON sngpc_movimentacoes(paciente_id);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_mov_receita ON sngpc_movimentacoes(numero_receita);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_tenant ON sngpc_notificacoes_receita(tenant_id);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_numero ON sngpc_notificacoes_receita(numero, serie);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_paciente ON sngpc_notificacoes_receita(paciente_id);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_data ON sngpc_notificacoes_receita(data_emissao);

-- Source: 20260323900000_sngpc_livro_registro_v1.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_notif_status ON sngpc_notificacoes_receita(status);

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE INDEX idx_sngpc_transmissoes_tenant ON sngpc_transmissoes(tenant_id);

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE INDEX idx_sngpc_transmissoes_status ON sngpc_transmissoes(status);

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE INDEX idx_sngpc_transmissoes_periodo ON sngpc_transmissoes(data_inicio, data_fim);

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE INDEX idx_sngpc_transmissoes_hash ON sngpc_transmissoes(hash_anvisa) WHERE hash_anvisa IS NOT NULL;

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE INDEX idx_sngpc_transmissoes_data_envio ON sngpc_transmissoes(data_envio DESC);

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE INDEX idx_sngpc_log_transmissao ON sngpc_transmissoes_log(transmissao_id);

-- Source: 20260324000000_sngpc_transmissoes_v1.sql
CREATE INDEX idx_sngpc_log_data ON sngpc_transmissoes_log(executado_em DESC);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_report_definitions_tenant ON report_definitions(tenant_id);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_report_definitions_category ON report_definitions(category);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_report_definitions_template ON report_definitions(is_template) WHERE is_template = true;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_user_saved_reports_tenant ON user_saved_reports(tenant_id);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_user_saved_reports_user ON user_saved_reports(user_id);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_user_saved_reports_favorite ON user_saved_reports(user_id, is_favorite) WHERE is_favorite = true;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_report_schedules_tenant ON report_schedules(tenant_id);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_report_schedules_next ON report_schedules(next_send_at) WHERE is_active = true;

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_report_executions_tenant ON report_executions(tenant_id);

-- Source: 20260324100000_custom_reports_v1.sql
CREATE INDEX idx_report_executions_date ON report_executions(executed_at DESC);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_tsa_config_tenant ON tsa_config(tenant_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_tsa_timestamps_tenant ON tsa_timestamps(tenant_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_tsa_timestamps_document ON tsa_timestamps(document_type, document_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_tsa_timestamps_status ON tsa_timestamps(status);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_prontuario_exports_tenant ON prontuario_exports(tenant_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_prontuario_exports_client ON prontuario_exports(client_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_prontuario_exports_status ON prontuario_exports(status);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_ripd_reports_tenant ON ripd_reports(tenant_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_sbis_documentation_tenant ON sbis_documentation(tenant_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_sbis_documentation_category ON sbis_documentation(category);

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE INDEX IF NOT EXISTS idx_backup_logs_tenant ON backup_logs(tenant_id);

-- Source: 20260324200000_compliance_tsa_v1.sql
CREATE INDEX idx_backup_logs_date ON backup_logs(created_at DESC);

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);

-- Source: 20260324200000_email_verification_codes.sql
CREATE INDEX IF NOT EXISTS idx_evc_user_id ON public.email_verification_codes(user_id);

-- Source: 20260324200000_email_verification_codes.sql
CREATE INDEX IF NOT EXISTS idx_evc_email   ON public.email_verification_codes(email);

-- Source: 20260324300000_push_notifications_v1.sql
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Source: 20260324300000_push_notifications_v1.sql
CREATE INDEX idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);

-- Source: 20260324300000_push_notifications_v1.sql
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;

-- Source: 20260324300000_push_notifications_v1.sql
CREATE INDEX idx_push_log_tenant ON push_notifications_log(tenant_id);

-- Source: 20260324300000_push_notifications_v1.sql
CREATE INDEX idx_push_log_user ON push_notifications_log(user_id);

-- Source: 20260324300000_push_notifications_v1.sql
CREATE INDEX idx_push_log_date ON push_notifications_log(sent_at DESC);

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE INDEX IF NOT EXISTS idx_backup_logs_created ON backup_logs(created_at DESC);

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE INDEX IF NOT EXISTS idx_backup_logs_type ON backup_logs(backup_type);

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE INDEX IF NOT EXISTS idx_backup_verifications_backup ON backup_verifications(backup_log_id);

-- Source: 20260324400000_backup_logs_sbis_v1.sql
CREATE INDEX IF NOT EXISTS idx_backup_retention_tenant ON backup_retention_policies(tenant_id);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_dpo_config_tenant ON dpo_config(tenant_id);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_tenant ON lgpd_solicitacoes(tenant_id);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_status ON lgpd_solicitacoes(status);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_tipo ON lgpd_solicitacoes(tipo);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_prazo ON lgpd_solicitacoes(prazo_resposta);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_incidentes_tenant ON lgpd_incidentes(tenant_id);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_incidentes_status ON lgpd_incidentes(status);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_incidentes_severidade ON lgpd_incidentes(severidade);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_consentimentos_tenant ON lgpd_consentimentos(tenant_id);

-- Source: 20260324500000_lgpd_dpo_anpd_v1.sql
CREATE INDEX IF NOT EXISTS idx_lgpd_consentimentos_titular ON lgpd_consentimentos(titular_email);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_adverse_events_tenant ON adverse_events(tenant_id);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_adverse_events_status ON adverse_events(tenant_id, status);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_adverse_events_data ON adverse_events(tenant_id, data_evento);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_adverse_events_severidade ON adverse_events(tenant_id, severidade);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_adverse_events_tipo ON adverse_events(tenant_id, tipo);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_adverse_events_client ON adverse_events(client_id);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_ona_indicators_tenant ON ona_indicators(tenant_id);

-- Source: 20260324600000_ona_accreditation_v1.sql
CREATE INDEX idx_ona_indicators_periodo ON ona_indicators(tenant_id, periodo_inicio, periodo_fim);

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE INDEX IF NOT EXISTS idx_clients_retention_expires 
ON clients(tenant_id, retention_expires_at) 
WHERE retention_expires_at IS NOT NULL;

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE INDEX idx_retention_deletion_attempts_tenant 
ON retention_deletion_attempts(tenant_id, attempted_at DESC);

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE INDEX idx_archived_clinical_data_tenant 
ON archived_clinical_data(tenant_id);

-- Source: 20260324700000_cfm_retention_policy_v1.sql
CREATE INDEX idx_archived_clinical_data_client 
ON archived_clinical_data(tenant_id, client_cpf);

-- Source: 20260324700001_nfse_nfeio_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_tenant ON nfse_invoices(tenant_id);

-- Source: 20260324700001_nfse_nfeio_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_status ON nfse_invoices(nfeio_status);

-- Source: 20260324700001_nfse_nfeio_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_payment ON nfse_invoices(payment_id);

-- Source: 20260324700001_nfse_nfeio_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_client ON nfse_invoices(client_id);

-- Source: 20260324700001_nfse_nfeio_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_nfse_invoices_issued ON nfse_invoices(issued_at);

-- Source: 20260324800000_return_automation_v1.sql
CREATE INDEX idx_return_reminders_tenant ON return_reminders(tenant_id);

-- Source: 20260324800000_return_automation_v1.sql
CREATE INDEX idx_return_reminders_client ON return_reminders(client_id);

-- Source: 20260324800000_return_automation_v1.sql
CREATE INDEX idx_return_reminders_status ON return_reminders(tenant_id, status);

-- Source: 20260324800000_return_automation_v1.sql
CREATE INDEX idx_return_reminders_date ON return_reminders(tenant_id, return_date);

-- Source: 20260324800000_return_automation_v1.sql
CREATE INDEX idx_return_reminders_pending ON return_reminders(tenant_id, return_date) 
  WHERE status IN ('pending', 'notified');

-- Source: 20260324900000_patient_call_queue_v1.sql
CREATE INDEX idx_patient_calls_tenant ON patient_calls(tenant_id);

-- Source: 20260324900000_patient_call_queue_v1.sql
CREATE INDEX idx_patient_calls_status ON patient_calls(tenant_id, status);

-- Source: 20260324900000_patient_call_queue_v1.sql
CREATE INDEX idx_patient_calls_date ON patient_calls(tenant_id, created_at);

-- Source: 20260628700000_consolidate_queue_system.sql
CREATE INDEX IF NOT EXISTS idx_patient_calls_waiting
  ON patient_calls(tenant_id, priority, checked_in_at)
  WHERE status = 'waiting';

-- Source: 20260325000000_dental_images_v1.sql
CREATE INDEX IF NOT EXISTS idx_dental_images_tenant ON dental_images(tenant_id);

-- Source: 20260325000000_dental_images_v1.sql
CREATE INDEX IF NOT EXISTS idx_dental_images_client ON dental_images(client_id);

-- Source: 20260325000000_dental_images_v1.sql
CREATE INDEX IF NOT EXISTS idx_dental_images_type ON dental_images(image_type);

-- Source: 20260325000000_dental_images_v1.sql
CREATE INDEX IF NOT EXISTS idx_dental_images_record ON dental_images(medical_record_id);

-- Source: 20260325000000_dental_images_v1.sql
CREATE INDEX IF NOT EXISTS idx_dental_images_captured ON dental_images(captured_at DESC);

-- Source: 20260325000001_odontograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_odontograms_professional 
  ON public.odontograms(professional_id);

-- Source: 20260325000001_odontograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_odontograms_appointment 
  ON public.odontograms(appointment_id);

-- Source: 20260325000001_odontograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_odontogram_teeth_odontogram 
  ON public.odontogram_teeth(odontogram_id);

-- Source: 20260325000001_odontograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_odontogram_teeth_tooth 
  ON public.odontogram_teeth(odontogram_id, tooth_number);

-- Source: 20260325100000_health_credits_engine.sql
CREATE INDEX IF NOT EXISTS idx_health_credits_tx_expires
  ON public.health_credits_transactions (expires_at)
  WHERE expires_at IS NOT NULL AND type = 'earn';

-- Source: 20260325100000_periograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_periograms_tenant ON periograms(tenant_id);

-- Source: 20260325100000_periograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_periograms_client ON periograms(client_id);

-- Source: 20260325100000_periograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_periograms_date ON periograms(exam_date DESC);

-- Source: 20260325100000_periograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_periogram_measurements_periogram ON periogram_measurements(periogram_id);

-- Source: 20260325100000_periograms_v1.sql
CREATE INDEX IF NOT EXISTS idx_periogram_measurements_tooth ON periogram_measurements(tooth_number);

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE INDEX IF NOT EXISTS idx_treatment_plans_tenant_client ON public.treatment_plans(tenant_id, client_id);

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE INDEX IF NOT EXISTS idx_treatment_plans_professional ON public.treatment_plans(professional_id);

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON public.treatment_plans(tenant_id, status);

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_plan ON public.treatment_plan_items(plan_id);

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_status ON public.treatment_plan_items(plan_id, status);

-- Source: 20260325100001_treatment_plans_v1.sql
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_tooth ON public.treatment_plan_items(plan_id, tooth_number);

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_tenant 
  ON tenant_feature_overrides(tenant_id);

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_feature 
  ON tenant_feature_overrides(tenant_id, feature_key);

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_expires 
  ON tenant_feature_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_limit_overrides_tenant 
  ON tenant_limit_overrides(tenant_id);

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_limit_overrides_limit 
  ON tenant_limit_overrides(tenant_id, limit_key);

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_limit_overrides_expires 
  ON tenant_limit_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_override_audit_log_tenant 
  ON override_audit_log(tenant_id);

-- Source: 20260325300000_tenant_overrides_v1.sql
CREATE INDEX IF NOT EXISTS idx_override_audit_log_override 
  ON override_audit_log(override_type, override_id);

-- Source: 20260326000000_patient_portal_scheduling_v1.sql
CREATE INDEX IF NOT EXISTS idx_appointment_ratings_tenant ON public.appointment_ratings(tenant_id);

-- Source: 20260326000000_patient_portal_scheduling_v1.sql
CREATE INDEX IF NOT EXISTS idx_appointment_ratings_patient ON public.appointment_ratings(patient_user_id);

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_invoices_tenant ON public.patient_invoices(tenant_id);

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_invoices_client ON public.patient_invoices(client_id);

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_invoices_status ON public.patient_invoices(tenant_id, status);

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_invoices_due_date ON public.patient_invoices(tenant_id, due_date);

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_payments_tenant ON public.patient_payments(tenant_id);

-- Source: 20260326100000_patient_portal_financial_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_payments_invoice ON public.patient_payments(invoice_id);

-- Source: 20260326200000_patient_portal_messages_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_messages_tenant ON public.patient_messages(tenant_id);

-- Source: 20260326200001_fix_patient_messages_patient_id.sql
CREATE INDEX IF NOT EXISTS idx_patient_messages_patient ON public.patient_messages(patient_id);

-- Source: 20260326200000_patient_portal_messages_v1.sql
CREATE INDEX IF NOT EXISTS idx_message_templates_tenant ON public.message_templates(tenant_id);

-- Source: 20260326300000_patient_portal_health_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_client ON public.patient_vaccinations(client_id);

-- Source: 20260326300000_patient_portal_health_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_tenant ON public.patient_vaccinations(tenant_id);

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_dependents_parent ON public.patient_dependents(parent_client_id);

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_dependents_tenant ON public.patient_dependents(tenant_id);

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_onboarding_user ON public.patient_onboarding(patient_user_id);

-- Source: 20260326400000_patient_portal_engagement_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_achievements_user ON public.patient_achievements(patient_user_id);

-- Source: 20260327000000_commission_rules_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant_professional 
    ON public.commission_rules(tenant_id, professional_id);

-- Source: 20260327000000_commission_rules_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant_service 
    ON public.commission_rules(tenant_id, service_id) WHERE service_id IS NOT NULL;

-- Source: 20260327000000_commission_rules_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant_insurance 
    ON public.commission_rules(tenant_id, insurance_id) WHERE insurance_id IS NOT NULL;

-- Source: 20260327000000_commission_rules_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_rules_active 
    ON public.commission_rules(tenant_id, professional_id, is_active) WHERE is_active = TRUE;

-- Source: 20260327000000_commission_rules_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_rules_priority 
    ON public.commission_rules(tenant_id, professional_id, priority DESC);

-- Source: 20260327000000_commission_rules_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_default
    ON public.commission_rules(tenant_id, professional_id)
    WHERE rule_type = 'default' AND is_active = TRUE;

-- Source: 20260327000000_commission_rules_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_service
    ON public.commission_rules(tenant_id, professional_id, service_id)
    WHERE rule_type = 'service' AND service_id IS NOT NULL AND is_active = TRUE;

-- Source: 20260327000000_commission_rules_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_insurance
    ON public.commission_rules(tenant_id, professional_id, insurance_id)
    WHERE rule_type = 'insurance' AND insurance_id IS NOT NULL AND is_active = TRUE;

-- Source: 20260327000000_commission_rules_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique_procedure
    ON public.commission_rules(tenant_id, professional_id, procedure_code)
    WHERE rule_type = 'procedure' AND procedure_code IS NOT NULL AND is_active = TRUE;

-- Source: 20260327300000_referral_commission_v1.sql
CREATE INDEX IF NOT EXISTS idx_appointments_booked_by 
ON public.appointments(booked_by_id) 
WHERE booked_by_id IS NOT NULL;

-- Source: 20260327500000_tier_change_notification_v1.sql
CREATE INDEX IF NOT EXISTS idx_tier_tracking_professional 
ON public.professional_tier_tracking(professional_id);

-- Source: 20260327500000_tier_change_notification_v1.sql
CREATE INDEX IF NOT EXISTS idx_tier_tracking_tenant 
ON public.professional_tier_tracking(tenant_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateways_tenant 
ON public.tenant_payment_gateways(tenant_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateways_active 
ON public.tenant_payment_gateways(tenant_id, is_active) 
WHERE is_active = TRUE;

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_professional_payment_accounts_professional 
ON public.professional_payment_accounts(professional_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_professional_payment_accounts_tenant 
ON public.professional_payment_accounts(tenant_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_professional_payment_accounts_gateway 
ON public.professional_payment_accounts(gateway_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_split_payment_logs_tenant 
ON public.split_payment_logs(tenant_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_split_payment_logs_appointment 
ON public.split_payment_logs(appointment_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_split_payment_logs_charge 
ON public.split_payment_logs(charge_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_split_payment_logs_professional 
ON public.split_payment_logs(professional_id);

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE INDEX IF NOT EXISTS idx_split_payment_logs_status 
ON public.split_payment_logs(status);

-- Source: 20260327700000_financial_notifications_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_disputes_tenant ON public.commission_disputes(tenant_id);

-- Source: 20260327700000_financial_notifications_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_disputes_professional ON public.commission_disputes(professional_id);

-- Source: 20260327700000_financial_notifications_v1.sql
CREATE INDEX IF NOT EXISTS idx_commission_disputes_status ON public.commission_disputes(status);

-- Source: 20260328200000_consent_pdf_upload_v1.sql
CREATE INDEX IF NOT EXISTS idx_consent_templates_type 
ON public.consent_templates(tenant_id, template_type);

-- Source: 20260328400000_consent_signing_tokens_v1.sql
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_token ON public.consent_signing_tokens(token);

-- Source: 20260328400000_consent_signing_tokens_v1.sql
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_client ON public.consent_signing_tokens(client_id);

-- Source: 20260328400000_consent_signing_tokens_v1.sql
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_tenant ON public.consent_signing_tokens(tenant_id);

-- Source: 20260328400000_consent_signing_tokens_v1.sql
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_expires ON public.consent_signing_tokens(expires_at) WHERE used_at IS NULL;

-- Source: 20260328600000_return_notification_v1.sql
CREATE INDEX IF NOT EXISTS idx_return_confirmation_tokens_token ON return_confirmation_tokens(token);

-- Source: 20260328600000_return_notification_v1.sql
CREATE INDEX IF NOT EXISTS idx_return_confirmation_tokens_return ON return_confirmation_tokens(return_id);

-- Source: 20260328600000_return_notification_v1.sql
CREATE INDEX IF NOT EXISTS idx_return_reminders_status_date 
  ON return_reminders(tenant_id, status, return_date);

-- Source: 20260328600000_return_notification_v1.sql
CREATE INDEX IF NOT EXISTS idx_return_reminders_notified 
  ON return_reminders(tenant_id, status) 
  WHERE status = 'pending' AND notified_at IS NULL;

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_certificates_tenant ON rnds_certificates(tenant_id);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_certificates_active ON rnds_certificates(tenant_id, is_active) WHERE is_active = TRUE;

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_tenant ON rnds_submissions(tenant_id);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_status ON rnds_submissions(status);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_pending ON rnds_submissions(tenant_id, status, scheduled_at) 
  WHERE status IN ('pending', 'retry');

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_patient ON rnds_submissions(patient_id);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_appointment ON rnds_submissions(appointment_id);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_submissions_resource ON rnds_submissions(resource_type, resource_id);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_tokens_tenant ON rnds_tokens(tenant_id);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_rnds_tokens_expires ON rnds_tokens(tenant_id, expires_at);

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_clients_cns ON clients(cns) WHERE cns IS NOT NULL;

-- Source: 20260329100000_rnds_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_profiles_cns ON profiles(cns) WHERE cns IS NOT NULL;

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_tenant ON transcription_jobs(tenant_id);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user ON transcription_jobs(user_id);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status ON transcription_jobs(status);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_created ON transcription_jobs(created_at DESC);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_tenant ON feedback_analysis(tenant_id);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment ON feedback_analysis(sentiment);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_action ON feedback_analysis(action_required) WHERE action_required = TRUE;

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_score ON feedback_analysis(score);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage_log(tenant_id);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_log(user_id);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage_log(feature);

-- Source: 20260329200000_ai_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_log(created_at DESC);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_connections_tenant ON hl7_connections(tenant_id);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_connections_active ON hl7_connections(tenant_id, is_active) WHERE is_active = TRUE;

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_field_mappings_connection ON hl7_field_mappings(connection_id);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_tenant ON hl7_message_log(tenant_id);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_connection ON hl7_message_log(connection_id);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_status ON hl7_message_log(tenant_id, status);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_received ON hl7_message_log(received_at DESC);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_patient ON hl7_message_log(patient_id) WHERE patient_id IS NOT NULL;

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_message_log_retry ON hl7_message_log(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_patient_mapping_tenant ON hl7_patient_mapping(tenant_id);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_patient_mapping_external ON hl7_patient_mapping(external_patient_id, external_system);

-- Source: 20260329300000_hl7_integration_v1.sql
CREATE INDEX IF NOT EXISTS idx_hl7_patient_mapping_client ON hl7_patient_mapping(client_id);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_tenant_theme_tenant ON tenant_theme_settings(tenant_id);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_video_tutorials_category ON video_tutorials(category);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_video_tutorials_feature ON video_tutorials(feature_key);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_video_tutorials_active ON video_tutorials(is_active) WHERE is_active = TRUE;

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_user_video_progress_user ON user_video_progress(user_id);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_user_video_progress_video ON user_video_progress(video_id);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_offline_cache_user ON offline_cache_metadata(user_id);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_offline_cache_tenant ON offline_cache_metadata(tenant_id);

-- Source: 20260329400000_ux_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_user_shortcuts_user ON user_keyboard_shortcuts(user_id);

-- Source: 20260330100000_financial_refactor_v1.sql
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_tenant ON public.accounts_receivable(tenant_id);

-- Source: 20260330100000_financial_refactor_v1.sql
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_appointment ON public.accounts_receivable(appointment_id);

-- Source: 20260330100000_financial_refactor_v1.sql
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_client ON public.accounts_receivable(client_id);

-- Source: 20260330100000_financial_refactor_v1.sql
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_professional ON public.accounts_receivable(professional_id);

-- Source: 20260330100000_financial_refactor_v1.sql
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status ON public.accounts_receivable(status);

-- Source: 20260330100000_financial_refactor_v1.sql
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_due_date ON public.accounts_receivable(due_date);

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_chat_channels_tenant ON public.chat_channels(tenant_id);

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel ON public.chat_channel_members(channel_id);

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_profile ON public.chat_channel_members(profile_id);

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_internal_messages_channel_id ON public.internal_messages(channel_id);

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_internal_messages_mentions ON public.internal_messages USING GIN(mentions);

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE INDEX IF NOT EXISTS idx_chat_read_status_profile ON public.chat_read_status(profile_id);

-- Source: 20260330500000_chat_improvements_v1.sql
CREATE INDEX idx_internal_messages_content_fts ON public.internal_messages 
      USING GIN(to_tsvector('portuguese', content));

-- Source: 20260330600000_certificate_digital_signature_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_certificates_signed 
  ON public.medical_certificates(tenant_id, signed_at DESC) 
  WHERE signed_at IS NOT NULL;

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE INDEX IF NOT EXISTS idx_profile_certificates_profile 
  ON public.profile_certificates(profile_id) WHERE is_active;

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE INDEX IF NOT EXISTS idx_profile_certificates_tenant 
  ON public.profile_certificates(tenant_id);

-- Source: 20260330700000_profile_certificates_v1.sql
CREATE INDEX IF NOT EXISTS idx_profile_certificates_default 
  ON public.profile_certificates(profile_id, is_default) WHERE is_default;

-- Source: 20260330800000_cfm_required_fields_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_records_attendance_number 
  ON public.medical_records(tenant_id, attendance_number);

-- Source: 20260330900000_document_verification_v1.sql
CREATE INDEX IF NOT EXISTS idx_document_verifications_hash ON public.document_verifications(document_hash);

-- Source: 20260330900000_document_verification_v1.sql
CREATE INDEX IF NOT EXISTS idx_document_verifications_document ON public.document_verifications(document_type, document_id);

-- Source: 20260330900000_document_verification_v1.sql
CREATE INDEX IF NOT EXISTS idx_document_verifications_tenant ON public.document_verifications(tenant_id);

-- Source: 20260330900000_document_verification_v1.sql
CREATE INDEX IF NOT EXISTS idx_document_verifications_verified_at ON public.document_verifications(verified_at DESC);

-- Source: 20260331000000_prescriptions_signature_fields_v1.sql
CREATE INDEX IF NOT EXISTS idx_prescriptions_signed 
  ON public.prescriptions(tenant_id, signed_at DESC) 
  WHERE signed_at IS NOT NULL;

-- Source: 20260331100000_ai_conversations.sql
CREATE INDEX idx_ai_conv_user       ON ai_conversations(user_id, updated_at DESC);

-- Source: 20260331100000_ai_conversations.sql
CREATE INDEX idx_ai_conv_tenant     ON ai_conversations(tenant_id);

-- Source: 20260331100000_ai_conversations.sql
CREATE INDEX idx_ai_conv_msgs_conv  ON ai_conversation_messages(conversation_id, created_at);

-- Source: 20260401100000_consent_verification_extension.sql
CREATE INDEX IF NOT EXISTS idx_patient_consents_sealed_pdf_hash
  ON public.patient_consents (sealed_pdf_hash)
  WHERE sealed_pdf_hash IS NOT NULL;

-- Source: 20260417100000_lgpd_patient_erasure_granular_rls.sql
CREATE INDEX IF NOT EXISTS idx_appointments_professional_patient
  ON public.appointments (professional_id, patient_id)
  WHERE status <> 'cancelled';

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_medical_records_tenant_patient_date
  ON medical_records (tenant_id, patient_id, record_date DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_patient_date
  ON prescriptions (tenant_id, patient_id, issued_at DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_medical_certificates_tenant_patient_date
  ON medical_certificates (tenant_id, patient_id, issued_at DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_scheduled
  ON appointments (tenant_id, scheduled_at);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_prof_scheduled
  ON appointments (tenant_id, professional_id, scheduled_at);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_patient_scheduled
  ON appointments (tenant_id, patient_id, scheduled_at DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_date
  ON financial_transactions (tenant_id, transaction_date DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_status
  ON waitlist (tenant_id, status);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_referrals_tenant_created
  ON referrals (tenant_id, created_at DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_exam_results_tenant_patient_date
  ON exam_results (tenant_id, patient_id, created_at DESC);

-- Source: 20260615000000_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_tenant_patient_date
  ON clinical_evolutions (tenant_id, patient_id, evolution_date DESC);

-- Source: 20260616000000_patient_exam_uploads_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_uploaded_exams_user
  ON public.patient_uploaded_exams(user_id);

-- Source: 20260616000000_patient_exam_uploads_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_uploaded_exams_tenant
  ON public.patient_uploaded_exams(tenant_id);

-- Source: 20260616000000_patient_exam_uploads_v1.sql
CREATE INDEX IF NOT EXISTS idx_patient_uploaded_exams_patient
  ON public.patient_uploaded_exams(patient_id);

-- Source: 20260628700000_consolidate_queue_system.sql
CREATE INDEX IF NOT EXISTS idx_patient_calls_triaged
  ON patient_calls(tenant_id, is_triaged, created_at)
  WHERE status = 'waiting';

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE INDEX IF NOT EXISTS idx_exam_results_tuss_code ON public.exam_results(tuss_code) WHERE tuss_code IS NOT NULL;

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_type ON public.exam_results(tenant_id, exam_type);

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_reports_tenant    ON public.medical_reports(tenant_id);

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_reports_patient   ON public.medical_reports(patient_id);

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_reports_record    ON public.medical_reports(medical_record_id);

-- Source: 20260629100000_exam_results_overhaul_v1.sql
CREATE INDEX IF NOT EXISTS idx_medical_reports_prof      ON public.medical_reports(professional_id);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_patient_notif_prefs_client
  ON public.patient_notification_preferences(client_id);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_patient_notif_prefs_tenant
  ON public.patient_notification_preferences(tenant_id);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant
  ON public.notification_logs(tenant_id, created_at DESC);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient
  ON public.notification_logs(recipient_id);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
  ON public.notification_logs(status);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_tenant_phone
  ON public.chatbot_conversations(tenant_id, phone);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_state
  ON public.chatbot_conversations(state);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_chatbot_conv_updated
  ON public.chatbot_conversations(updated_at);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_chatbot_msg_conv
  ON public.chatbot_messages(conversation_id, created_at);

-- Source: 20260702000000_notification_system_v2.sql
CREATE INDEX IF NOT EXISTS idx_chatbot_msg_tenant
  ON public.chatbot_messages(tenant_id, created_at DESC);

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE INDEX IF NOT EXISTS idx_sales_conv_phone
  ON public.sales_chatbot_conversations(phone);

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE INDEX IF NOT EXISTS idx_sales_conv_updated
  ON public.sales_chatbot_conversations(updated_at DESC);

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE INDEX IF NOT EXISTS idx_sales_msg_conv
  ON public.sales_chatbot_messages(conversation_id, created_at);

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE INDEX IF NOT EXISTS idx_sales_leads_status
  ON public.sales_leads(status);

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE INDEX IF NOT EXISTS idx_sales_leads_source
  ON public.sales_leads(source);

-- Source: 20260703000000_sales_chatbot_leads.sql
CREATE INDEX IF NOT EXISTS idx_sales_leads_created
  ON public.sales_leads(created_at DESC);

-- Source: 20260704500000_waitlist_auto_notify_on_cancel.sql
CREATE INDEX IF NOT EXISTS idx_waitlist_notifications_pending
  ON public.waitlist_notifications (tenant_id, status, created_at)
  WHERE status = 'pending';

-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_pending
  ON appointments (tenant_id, scheduled_at)
  WHERE status IN ('pending', 'confirmed') AND confirmed_at IS NULL;

-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
CREATE INDEX IF NOT EXISTS idx_pre_consultation_responses_appointment
  ON pre_consultation_responses (appointment_id);

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE INDEX idx_ai_metrics_tenant_module ON public.ai_performance_metrics(tenant_id, module_name);

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE INDEX idx_ai_metrics_created ON public.ai_performance_metrics(created_at DESC);

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE INDEX idx_ai_metrics_interaction ON public.ai_performance_metrics(interaction_id);

-- Source: 20260704700000_ai_performance_metrics.sql
CREATE INDEX idx_ai_metrics_feedback ON public.ai_performance_metrics(user_feedback) WHERE user_feedback IS NOT NULL;

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE INDEX IF NOT EXISTS idx_odontogram_tooth_history_odontogram 
  ON public.odontogram_tooth_history(odontogram_id);

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE INDEX IF NOT EXISTS idx_odontogram_tooth_history_tooth 
  ON public.odontogram_tooth_history(odontogram_id, tooth_number);

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE INDEX IF NOT EXISTS idx_odontogram_tooth_history_changed_at 
  ON public.odontogram_tooth_history(changed_at DESC);

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_tooth_id
  ON public.treatment_plan_items(odontogram_tooth_id);

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE INDEX IF NOT EXISTS idx_dental_prescriptions_tenant ON public.dental_prescriptions(tenant_id);

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE INDEX IF NOT EXISTS idx_dental_prescriptions_patient ON public.dental_prescriptions(patient_id);

-- Source: 20260719000000_dental_module_enhancements_v1.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dental_stats_pk 
  ON public.mv_dental_stats(tenant_id, patient_id);

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE INDEX IF NOT EXISTS idx_periogram_measurements_cal
  ON public.periogram_measurements(clinical_attachment_level)
  WHERE clinical_attachment_level IS NOT NULL;

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limits_cleanup
  ON public.rpc_rate_limits(window_start);

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE INDEX IF NOT EXISTS idx_tuss_odonto_prices_tenant ON public.tuss_odonto_prices(tenant_id);

-- Source: 20260720000000_dental_rpc_fixes_v2.sql
CREATE INDEX IF NOT EXISTS idx_tuss_odonto_prices_code ON public.tuss_odonto_prices(tenant_id, tuss_code);

-- Source: 20260721000000_document_signatures_v1.sql
CREATE INDEX IF NOT EXISTS idx_document_signatures_patient ON public.document_signatures(patient_id);

-- Source: 20260721000000_document_signatures_v1.sql
CREATE INDEX IF NOT EXISTS idx_document_signatures_tenant  ON public.document_signatures(tenant_id);

-- Source: 20260721000000_document_signatures_v1.sql
CREATE INDEX IF NOT EXISTS idx_document_signatures_doc     ON public.document_signatures(document_type, document_id);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_tenant ON public.sngpc_tracked_prescriptions(tenant_id);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_patient ON public.sngpc_tracked_prescriptions(patient_id);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_lista ON public.sngpc_tracked_prescriptions(anvisa_lista);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_status ON public.sngpc_tracked_prescriptions(dispensation_status);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_sngpc_expires ON public.sngpc_tracked_prescriptions(expires_at);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_tenant ON public.incoming_rnds_bundles(tenant_id);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_status ON public.incoming_rnds_bundles(review_status);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_patient ON public.incoming_rnds_bundles(matched_patient_id);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_cpf ON public.incoming_rnds_bundles(patient_cpf);

-- Source: 20260723000000_sngpc_and_rnds_bidirectional.sql
CREATE INDEX IF NOT EXISTS idx_rnds_incoming_received ON public.incoming_rnds_bundles(received_at DESC);

-- Source: 20260724000000_security_validate_patient_access_hardening.sql
CREATE INDEX IF NOT EXISTS idx_patient_access_attempts_hash_created
  ON public.patient_access_attempts (identifier_hash, created_at DESC);

-- Source: 20260724000001_lgpd_patient_data_export_deletion.sql
CREATE INDEX IF NOT EXISTS idx_patient_deletion_status
  ON public.patient_deletion_requests (status, scheduled_for)
  WHERE status = 'pending';

-- Source: 20260724000003_patient_activity_log.sql
CREATE INDEX IF NOT EXISTS idx_patient_activity_log_user_created
  ON public.patient_activity_log (patient_user_id, created_at DESC);

