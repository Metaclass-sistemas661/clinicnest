-- ============================================================
-- Política UPDATE para patient_consents
-- Permite que o paciente atualize o snapshot_html do termo
-- que ele mesmo assinou (necessário para preencher variáveis)
-- ============================================================

-- Paciente pode atualizar seus próprios aceites (snapshot com dados preenchidos)
CREATE POLICY "Patients can update own consents"
  ON public.patient_consents FOR UPDATE
  TO authenticated
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

-- FORCE RLS (caso não esteja ativo)
ALTER TABLE public.patient_consents FORCE ROW LEVEL SECURITY;
