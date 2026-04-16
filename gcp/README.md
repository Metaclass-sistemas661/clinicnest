# ClinicaFlow - Google Cloud Platform Infrastructure

## Estrutura

``
gcp/
├── cloud-run/            # Backend API (Node.js/Express no Cloud Run)
│   ├── src/
│   │   ├── functions/    # 65 endpoints (AI, pagamentos, auth, etc.)
│   │   ├── routes/       # REST proxy + security middleware
│   │   └── shared/       # DB, auth, email, logging, rate-limit, GCS
│   ├── Dockerfile
│   ├── package.json
│   └── vitest.config.ts
└── README.md
``

## Stack

- **Cloud SQL PostgreSQL 15** - Banco de dados principal
- **Cloud Run** - API backend (65 endpoints)
- **Firebase Auth** - Autenticação
- **Cloud Storage** - Armazenamento de arquivos
- **Secret Manager** - Gerenciamento de credenciais
- **Artifact Registry** - Imagens Docker
