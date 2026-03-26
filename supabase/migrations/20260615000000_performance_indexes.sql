-- Performance indexes for high-frequency queries
-- Composite indexes on tables that are frequently queried with tenant_id + other filters

-- medical_records: tenant_id + patient_id + record_date (prontuário listing)
CREATE INDEX IF NOT EXISTS idx_medical_records_tenant_patient_date
  ON medical_records (tenant_id, patient_id, record_date DESC);

-- prescriptions: tenant_id + patient_id + issued_at (receitas listing)
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_patient_date
  ON prescriptions (tenant_id, patient_id, issued_at DESC);

-- medical_certificates: tenant_id + patient_id + issued_at
CREATE INDEX IF NOT EXISTS idx_medical_certificates_tenant_patient_date
  ON medical_certificates (tenant_id, patient_id, issued_at DESC);

-- audit_logs: tenant_id + created_at (auditoria)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

-- appointments: tenant_id + scheduled_at (agenda queries - most common query)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_scheduled
  ON appointments (tenant_id, scheduled_at);

-- appointments: tenant_id + professional_id + scheduled_at (agenda by professional)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_prof_scheduled
  ON appointments (tenant_id, professional_id, scheduled_at);

-- appointments: tenant_id + patient_id + scheduled_at (patient appointment history)
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_patient_scheduled
  ON appointments (tenant_id, patient_id, scheduled_at DESC);

-- financial_transactions: tenant_id + date (relatórios financeiros)
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_date
  ON financial_transactions (tenant_id, transaction_date DESC);

-- waitlist: tenant_id + status (lista de espera ativa)
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_status
  ON waitlist (tenant_id, status);

-- referrals: tenant_id + created_at (encaminhamentos)
CREATE INDEX IF NOT EXISTS idx_referrals_tenant_created
  ON referrals (tenant_id, created_at DESC);

-- exam_results: tenant_id + patient_id + created_at
CREATE INDEX IF NOT EXISTS idx_exam_results_tenant_patient_date
  ON exam_results (tenant_id, patient_id, created_at DESC);

-- clinical_evolutions: tenant_id + patient_id + evolution_date
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_tenant_patient_date
  ON clinical_evolutions (tenant_id, patient_id, evolution_date DESC);
