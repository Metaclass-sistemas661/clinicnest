# Auditoria: Frontend vs. Migrações Cloud SQL

**Data:** 2025-04-16  
**Escopo:** Todas as referências `.from("tabela")`, `.select()`, `.insert()`, `.update()` no frontend e cloud-run functions comparadas com os arquivos de migração SQL.

---

## ⚠️ ACHADO CRÍTICO #0 — Migrações quase inexistentes no disco

Apenas **3 arquivos SQL** existem em `gcp/migrations/`:

| Arquivo | Tabela(s) criadas |
|---|---|
| `001_foundation/003_tenants.sql` | `tenants` |
| `001_foundation/006_subscriptions.sql` | `subscriptions` |
| `003_fixes/001_fix_tenant_trigger_schema_gaps.sql` | Patches em `payment_methods`, `lgpd_retention_policies` |

Todos os demais diretórios (`002_clinical`, `003_financial`, `004_products`, etc.) **não existem**.  
O VS Code indexou migrações planejadas que nunca foram commitadas — essas são usadas como referência "cached" nesta auditoria.

---

## ⚠️ ACHADO CRÍTICO #1 — Nome de tabela divergente entre backend functions

| Tabela no Frontend / REST Proxy | Tabela nas Migrações (cache) | Onde aparece o nome antigo |
|---|---|---|
| `patients` | `clients` | `run-campaign.ts` (linha 207), `notify-patient-message.ts` (linha 176) |
| `procedures` | `services` | `waitlist-auto-book.ts` (linha 80) |

O frontend e o `rest-proxy.ts` usam `patients` e `procedures`.  
Algumas cloud-run functions ainda usam `clients` e `services` (nomes antigos).

---

## Tabela 1 — `patients` 🔴 CRÍTICO

### Migração no disco: **NÃO EXISTE**
### Migração cache (`clients`): colunas diferentes

| Coluna no frontend (TypeScript + queries) | Na migration cache? | No `_check.js`? | Status |
|---|---|---|---|
| `id` | ✅ | — | OK |
| `tenant_id` | ✅ | — | OK |
| `name` | ✅ | — | OK |
| `phone` | ✅ | — | OK |
| `email` | ✅ | — | OK |
| `notes` | ✅ | — | OK |
| `cpf` | ✅ | — | OK |
| `access_code` | ✅ | — | OK |
| `date_of_birth` | ❌ (cache tem `birth_date`) | ✅ adicionado | OK (patcheado) |
| `marital_status` | ❌ | ✅ adicionado | OK (patcheado) |
| `zip_code` | ✅ | — | OK |
| `street` | ❌ (cache tem `address`) | ✅ adicionado | OK (patcheado) |
| `street_number` | ❌ | ✅ adicionado | OK (patcheado) |
| `complement` | ❌ | ✅ adicionado | OK (patcheado) |
| `neighborhood` | ❌ | ✅ adicionado | OK (patcheado) |
| `city` | ✅ | — | OK |
| `state` | ✅ | — | OK |
| `allergies` | ✅ | — | OK |
| `insurance_plan_id` | ❌ | ✅ adicionado | OK (patcheado) |
| `insurance_card_number` | ❌ | ✅ adicionado | OK (patcheado) |
| **`is_active`** | ❌ | ❌ | 🔴 **MISSING** — filtrado em `FinanceiroBillsReceivableTab.tsx` |
| `created_at` | ✅ | — | OK |
| `updated_at` | ✅ | — | OK |

**Ação necessária:** Verificar se `is_active` existe no Cloud SQL. Se não, adicionar via migração.

### Colunas na migration cache que o frontend NÃO usa:
`rg`, `gender`, `blood_type`, `chronic_conditions`, `emergency_contact_name`, `emergency_contact_phone`, `marketing_opt_out`, `photo_url`

---

## Tabela 2 — `appointments` 🔴 CRÍTICO

### Migração no disco: **NÃO EXISTE**

| Coluna no frontend | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `patient_id`, `procedure_id`, `professional_id` | ✅ | OK |
| `scheduled_at`, `duration_minutes`, `status`, `price`, `notes` | ✅ | OK |
| `consultation_type`, `insurance_plan_id`, `insurance_authorization` | ✅ | OK |
| `specialty_id`, `room_id`, `telemedicine`, `telemedicine_url`, `cid_code` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |
| **`source`** | ❌ | 🔴 **MISSING** — TypeScript interface |
| **`confirmed_at`** | ❌ | 🔴 **MISSING** — TypeScript interface |
| **`public_booking_token`** | ❌ | 🔴 **MISSING** — TypeScript interface |
| **`booked_by_id`** | ❌ | 🔴 **MISSING** — formulário usa `booked_by_id` |
| **`confirmation_sent_4h`** | ❌ | 🔴 **MISSING** — `automation-worker.ts` |
| **`confirmation_sent_1h`** | ❌ | 🔴 **MISSING** — `automation-worker.ts` |
| **`cancelled_at`** | ❌ | 🔴 **MISSING** — `whatsapp-chatbot.ts` atualiza este campo |
| **`appointment_date`** | ❌ | ⚠️ VERIFICAR — `Evolucoes.tsx` seleciona |
| **`start_time`** | ❌ | ⚠️ VERIFICAR — `Evolucoes.tsx` seleciona |

**Ação necessária:** Confirmar existência dessas 9 colunas no Cloud SQL.

---

## Tabela 3 — `procedures` 🟡 MÉDIO

### Migração no disco: **NÃO EXISTE** (cache tem `services`)

| Coluna no frontend | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `name`, `description`, `duration_minutes`, `price`, `is_active` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |
| `tuss_code` | ✅ | OK (only read in NovaGuiaTISS) |
| **`insurance_price`** | ❌ | 🔴 **MISSING** — `NovaGuiaTISS.tsx` seleciona |

### Colunas na migration cache não usadas no frontend:
`cost`, `commission_type`, `commission_value`, `category`, `requires_authorization`

---

## Tabela 4 — `medical_records` 🔴🔴 CRÍTICO (maior discrepância)

### Migração no disco: **NÃO EXISTE**
### Migration cache usa schema **SOAP antigo** completamente diferente do frontend

| Coluna no frontend (ProntuarioForm.tsx inserts) | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `patient_id`, `professional_id`, `appointment_id` | ✅ | OK |
| `notes` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |
| **`specialty_id`** | ❌ | 🔴 MISSING |
| **`triage_id`** | ❌ | 🔴 MISSING |
| **`template_id`** | ❌ | 🔴 MISSING |
| **`attendance_type`** | ❌ | 🔴 MISSING |
| **`chief_complaint`** | ❌ (cache: `subjective`) | 🔴 MISSING |
| **`anamnesis`** | ❌ | 🔴 MISSING |
| **`physical_exam`** | ❌ (cache: `objective`) | 🔴 MISSING |
| **`diagnosis`** | ❌ | 🔴 MISSING |
| **`cid_code`** | ❌ (cache: `cid_codes` ARRAY) | 🔴 MISSING (tipo diferente) |
| **`treatment_plan`** | ❌ (cache: `plan`) | 🔴 MISSING |
| **`prescriptions`** | ❌ | 🔴 MISSING (campo TEXT) |
| **`custom_fields`** | ❌ | 🔴 MISSING |
| **`record_date`** | ❌ | 🔴 MISSING |
| **`is_confidential`** | ❌ | 🔴 MISSING |
| **`blood_pressure_systolic`** | ❌ (cache: `vital_signs` JSONB) | 🔴 MISSING |
| **`blood_pressure_diastolic`** | ❌ | 🔴 MISSING |
| **`heart_rate`** | ❌ | 🔴 MISSING |
| **`respiratory_rate`** | ❌ | 🔴 MISSING |
| **`temperature`** | ❌ | 🔴 MISSING |
| **`oxygen_saturation`** | ❌ | 🔴 MISSING |
| **`weight_kg`** | ❌ | 🔴 MISSING |
| **`height_cm`** | ❌ | 🔴 MISSING |
| **`pain_scale`** | ❌ | 🔴 MISSING |
| **`allergies`** | ❌ | 🔴 MISSING |
| **`current_medications`** | ❌ | 🔴 MISSING |
| **`medical_history`** | ❌ | 🔴 MISSING |
| **`digital_hash`** | ❌ | 🔴 MISSING |
| **`signed_at`** | ✅ | OK |
| **`signed_by_name`** | ❌ (cache: `signed_by` UUID) | 🔴 MISSING |
| **`signed_by_crm`** | ❌ | 🔴 MISSING |
| **`return_days`** | ❌ | 🔴 MISSING |
| **`return_reason`** | ❌ | 🔴 MISSING |

**~30 colunas no frontend não existem na migration cache. O schema inteiro foi redesenhado.**

### Colunas na migration cache que o frontend NÃO usa:
`record_type`, `subjective`, `objective`, `assessment`, `plan`, `cid_codes`, `vital_signs`, `attachments`, `is_signed`, `signed_by`

---

## Tabela 5 — `prescriptions` 🔴 ALTO

### Migração no disco: **NÃO EXISTE**

| Coluna no frontend | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `patient_id`, `professional_id`, `appointment_id` | ✅ | OK |
| `medications` | ⚠️ JSONB no cache, TEXT no frontend | 🟡 Tipo diferente |
| `signed_at` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |
| **`medical_record_id`** | ❌ | 🔴 MISSING |
| **`instructions`** | ❌ (cache: `notes`) | 🔴 MISSING |
| **`validity_days`** | ❌ (cache: `valid_until` DATE) | 🔴 MISSING |
| **`prescription_type`** | ❌ | 🔴 MISSING |
| **`status`** | ❌ | 🔴 MISSING |
| **`signed_by_name`** | ❌ | 🔴 MISSING |
| **`signed_by_crm`** | ❌ | 🔴 MISSING |
| **`signed_by_uf`** | ❌ | 🔴 MISSING |
| **`digital_signature`** | ❌ | 🔴 MISSING |
| **`issued_at`** | ❌ | 🔴 MISSING — `PacienteDetalhe.tsx` seleciona |

### Colunas na migration cache não usadas:
`notes`, `is_controlled`, `is_signed`, `valid_until`

---

## Tabela 6 — `consent_templates` 🔴 ALTO

### Migração no disco: **NÃO EXISTE**

| Coluna no frontend | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `title`, `is_active` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |
| **`slug`** | ❌ | 🔴 MISSING |
| **`body_html`** | ❌ (cache: `content`) | 🔴 MISSING |
| **`is_required`** | ❌ (cache: `requires_photo`) | 🔴 MISSING |
| **`sort_order`** | ❌ | 🔴 MISSING |
| **`template_type`** | ❌ | 🔴 MISSING |
| **`pdf_storage_path`** | ❌ | 🔴 MISSING |
| **`pdf_original_filename`** | ❌ | 🔴 MISSING |
| **`pdf_file_size`** | ❌ | 🔴 MISSING |

### Colunas na migration cache não usadas:
`content`, `category`, `requires_photo`

---

## Tabela 7 — `stock_movements` 🟡 MÉDIO

| Coluna no frontend | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `product_id`, `quantity`, `movement_type`, `reason`, `created_by`, `created_at` | ✅ | OK |
| **`out_reason_type`** | ❌ | 🔴 MISSING — filtrado em `Produtos.tsx`, `Dashboard.tsx` |

---

## Tabela 8 — `products` 🟢 OK

| Coluna no frontend | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `name`, `description`, `cost`, `quantity`, `min_quantity`, `is_active` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |

Frontend usa subset; cache tem extras (`sku`, `barcode`, `sale_price`, `category_id`, `is_controlled`, `batch_number`, `expiry_date`).

---

## Tabela 9 — `financial_transactions` 🟢 OK

| Coluna no frontend | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `appointment_id`, `type`, `category`, `amount`, `description`, `transaction_date` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |

Frontend usa subset; cache tem extras (`payment_method`, `cost_center_id`).

---

## Tabela 10 — `profiles` 🟢 OK

Interface TypeScript e migration cache coincidem.

---

## Tabela 11 — `insurance_plans` 🟡 MÉDIO

| Coluna no frontend (TypeScript interface) | Na migration cache? | Status |
|---|---|---|
| `id`, `tenant_id`, `name`, `ans_code`, `is_active` | ✅ | OK |
| `created_at`, `updated_at` | ✅ | OK |
| **`contact_email`** | ❌ | 🔴 MISSING |
| **`reimbursement_days`** | ❌ | 🔴 MISSING |
| **`requires_authorization`** | ❌ | 🔴 MISSING |
| **`tiss_version`** | ❌ | 🔴 MISSING |
| **`notes`** | ❌ | 🔴 MISSING |

---

## Tabelas referenciadas no frontend SEM QUALQUER migração

Estas tabelas aparecem em chamadas `.from("tabela")` mas não possuem **nenhum** arquivo de migração (nem no disco, nem no cache):

| Tabela | Onde referenciada |
|---|---|
| `clinical_evolutions` | `DashboardClinico.tsx` |
| `nursing_evolutions` | Cloud-run functions |
| `treatment_plans` | `DashboardDentista.tsx` |
| `treatment_plan_items` | `DashboardDentista.tsx` |
| `aesthetic_sessions` | `DashboardEstetica.tsx` |
| `tiss_guides` | `DashboardFaturista.tsx`, `NovaGuiaTISS.tsx` |
| `tiss_glosa_appeals` | `DashboardFaturista.tsx` |
| `room_occupancies` | `DashboardEnfermeiro.tsx` |
| `clinic_rooms` | `DashboardEnfermeiro.tsx` (cache tem `rooms`) |
| `bills_receivable` | `FinanceiroBillsReceivableTab.tsx` |
| `bills_payable` | `FinanceiroBillsPayableTab.tsx` |
| `cost_centers` | `FinanceiroBillsPayableTab.tsx` |
| `commission_rules` | `CommissionRuleForm.tsx`, `CommissionPreview.tsx` |
| `commission_payments` | `send-weekly-financial-summary.ts` |
| `professional_payment_accounts` | `ProfessionalPaymentAccountForm.tsx` |
| `tenant_payment_gateways` | `ProfessionalPaymentAccountForm.tsx` |
| `professional_commissions` | `AdminCommissionReminderDialog.tsx` |
| `salary_payments` | `send-weekly-financial-summary.ts` |
| `professional_procedures` | `whatsapp-chatbot.ts` |
| `goal_suggestions` | `GoalSuggestionsAdminSection.tsx` |
| `goals` | `GoalSuggestionsAdminSection.tsx` |
| `video_tutorials` | `VideoTutorials.tsx` |
| `user_video_progress` | `VideoTutorials.tsx` |
| `user_tour_progress` | `TourContext.tsx` |
| `nps_responses` | `FeedbackNPSDialog.tsx` |
| `odontograms` | `UnifiedDentalRecord.tsx` |
| `periograms` | `UnifiedDentalRecord.tsx` |
| `patient_consents` | `PatientContractsDrawer.tsx`, `PatientConsentsViewer.tsx` |
| `consent_signing_links` | ALLOWED_TABLES |
| `consent_signatures` | ALLOWED_TABLES |
| `patient_invoices` | `FaturasPacientes.tsx` |
| `patient_proms` | `PatientPROMs.tsx` |
| `patient_messages` | `PatientMensagens.tsx` (via RPC) |
| `patient_conversations` | `notify-patient-message.ts` |
| `patient_profiles` | `twilio-video-token.ts` |
| `push_tokens` | `notify-patient-message.ts` |
| `chatbot_conversations` | `whatsapp-chatbot.ts` |
| `chatbot_messages` | `whatsapp-chatbot.ts` |
| `chatbot_settings` | `whatsapp-chatbot.ts` |
| `sales_chatbot_conversations` | `whatsapp-sales-chatbot.ts` |
| `sales_chatbot_messages` | `whatsapp-sales-chatbot.ts` |
| `sales_leads` | `whatsapp-sales-chatbot.ts` |
| `campaigns` | `run-campaign.ts` |
| `client_marketing_preferences` | `run-campaign.ts` (⚠️ nome antigo!) |
| `contact_messages` | `submit-contact-message.ts` |
| `support_tickets` | `send-support-ticket-email.ts` |
| `support_messages` | `send-support-ticket-email.ts` |
| `email_verification_codes` | `verify-email-code.ts` |
| `rnds_tokens` | `rnds-submit.ts` |
| `rnds_certificates` | `rnds-submit.ts` |
| `notification_logs` | Múltiplas cloud-run functions |
| `user_notification_preferences` | `GoalSuggestionsAdminSection.tsx`, cloud-run |
| `chat_channels` | `ChannelManager.tsx` |
| `attachments` | `AttachmentUpload.tsx` |
| `notifications` | `NotificationsBell.tsx` |
| `waitlist` | `DashboardMedico.tsx`, `waitlist-auto-book.ts` |
| `waitlist_notifications` | `waitlist-auto-book.ts` |

---

## Resumo Executivo

| Severidade | Qtd tabelas | Descrição |
|---|---|---|
| 🔴 CRÍTICO | 6 | `patients`, `appointments`, `procedures`, `medical_records`, `prescriptions`, `consent_templates` — schema do frontend diverge significativamente do cache de migração |
| 🟡 MÉDIO | 3 | `stock_movements`, `insurance_plans`, `clinic_rooms` (nome diferente) — colunas individuais faltando |
| 🟢 OK | 3 | `products`, `financial_transactions`, `profiles` — coincidem |
| ❓ SEM MIGRAÇÃO | **50+** | Tabelas referenciadas no código sem qualquer arquivo `.sql` de migração |

### Riscos de runtime:
1. **INSERTs falhando** — ProntuarioForm.tsx insere ~30 colunas em `medical_records` que não existem numa migration SOAP
2. **SELECTs retornando NULL** — e.g. `is_active` em patients, `out_reason_type` em stock_movements
3. **Nomes de tabela inconsistentes** — `clients` vs `patients`, `services` vs `procedures` em cloud-run functions
4. **50+ tabelas sem migração** — dependem de CREATE TABLE manuais no Cloud SQL

### Recomendação:
1. Executar `SELECT column_name FROM information_schema.columns WHERE table_name = 'X'` no Cloud SQL para cada tabela crítica
2. Gerar migrações definitivas baseadas no schema REAL do banco
3. Corrigir referências `clients`→`patients` e `services`→`procedures` nas cloud-run functions
4. Adicionar coluna `is_active` na tabela `patients` se não existir
