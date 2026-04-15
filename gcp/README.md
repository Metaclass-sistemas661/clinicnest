# ClinicaFlow — Google Cloud Platform Infrastructure

## Estrutura

```
gcp/
├── migrations/           # Migrations SQL organizadas por domínio (1 arquivo por tabela)
│   ├── 001_foundation/   # Enums, tenants, profiles, user_roles, helpers
│   ├── 002_clinical/     # appointments, medical_records, prescriptions, etc.
│   ├── 003_financial/    # transactions, orders, commissions, salary
│   ├── 004_patient_portal/ # patient_profiles, consents, portal features
│   ├── 005_inventory/    # products, stock, suppliers, purchases
│   ├── 006_odontology/   # odontograms, periograms, dental_images
│   ├── 007_compliance/   # LGPD, audit_logs, backup, ONA, SNGPC
│   ├── 008_integrations/ # HL7, RNDS, NFS-e, webhooks
│   ├── 009_ai_automation/# ai_conversations, automations, transcription
│   ├── 010_communications/ # chat, notifications, messages, campaigns
│   ├── 011_crm_loyalty/  # packages, cashback, vouchers, points
│   └── 012_storage_buckets/ # Cloud Storage bucket definitions
├── secrets/              # GCP Secret Manager configuration
│   ├── secrets-manifest.yaml   # Lista de todos os secrets + metadata
│   └── deploy-secrets.sh       # Script para criar secrets no GCP
└── README.md
```

## Regras de Migração

- **Cloud SQL PostgreSQL 15+** (compatível 1:1 com Supabase PostgreSQL)
- `auth.uid()` substituído por `current_setting('app.current_user_id')::uuid`
- `auth.jwt()` substituído por `current_setting('app.jwt_claims')::jsonb`
- `REFERENCES auth.users(id)` removido (Firebase Auth gerencia users externamente)
- RLS mantido onde aplicável via `SET app.current_user_id` na connection
- Cada tabela em seu próprio arquivo `.sql`
- Execução ordenada: 001 → 002 → ... → 012

## Secrets

Todos os secrets são gerenciados via **GCP Secret Manager**.
Nunca commitar valores no repositório. O `secrets-manifest.yaml` contém apenas nomes e metadata.
