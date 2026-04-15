#!/bin/bash
# ============================================================
# Step 4: Create all secrets in GCP Secret Manager
# Project: sistema-de-gestao-16e15
# ============================================================
set -euo pipefail

export GCP_PROJECT="sistema-de-gestao-16e15"
ENV_FILE="${1:-.env.secrets}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "Copy .env.secrets.example → .env.secrets and fill in real values."
  exit 1
fi

echo ">>> Creating secrets in GCP Secret Manager from $ENV_FILE"
echo ""

# All backend secrets that need to be in Secret Manager
SECRETS=(
  # Payment Gateways
  "ASAAS_API_KEY"
  "ASAAS_API_BASE_URL"
  "ASAAS_BASE_URL"
  "ASAAS_SANDBOX"
  "ASAAS_WEBHOOK_TOKEN"
  "PAGSEGURO_TOKEN"
  "PAGSEGURO_WEBHOOK_TOKEN"
  "STONE_WEBHOOK_TOKEN"
  "STRIPE_SECRET_KEY"
  "PUBLISHABLE_KEY"
  
  # WhatsApp / Evolution API
  "EVOLUTION_API_KEY"
  "EVOLUTION_API_URL"
  "EVOLUTION_SALES_API_KEY"
  "EVOLUTION_SALES_API_URL"
  "EVOLUTION_SALES_INSTANCE"
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
  
  # Email
  "RESEND_API_KEY"
  "RESEND_FROM"
  "EMAIL_FROM"
  "CLINIC_EMAIL_DOMAIN"
  "CONTACT_ADMIN_EMAIL"
  "CONTACT_EMAIL_FROM"
  "SUPPORT_EMAIL_FROM"
  "SUPPORT_EMAIL_TO"
  
  # Twilio
  "TWILIO_ACCOUNT_SID"
  "TWILIO_API_KEY_SID"
  "TWILIO_API_KEY_SECRET"
  "TWILIO_TOKEN_TTL_SECONDS"
  
  # AWS
  "AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY"
  "AWS_REGION"
  "AWS_S3_BUCKET"
  
  # GCP / AI
  "GCP_SERVICE_ACCOUNT_KEY"
  "GCP_REGION"
  "GEMINI_MODEL"
  
  # Cache
  "UPSTASH_REDIS_REST_URL"
  "UPSTASH_REDIS_REST_TOKEN"
  
  # Push
  "FCM_SERVER_KEY"
  
  # Auth / Internal
  "AUTOMATION_WORKER_KEY"
  "CRON_SECRET"
  "SALES_CHATBOT_SECRET"
  "SUPERADMIN_USER_IDS"
  
  # Config
  "PUBLIC_APP_URL"
  "PUBLIC_SITE_URL"
  "SITE_URL"
  "CORS_ALLOWED_ORIGINS"
  
  # GCP-specific (new)
  "CLOUDSQL_CONNECTION_STRING"
  "CLOUDSQL_DB_PASSWORD"
  "FIREBASE_API_KEY"
  "FIREBASE_SERVICE_ACCOUNT_KEY"
)

CREATED=0
UPDATED=0
SKIPPED=0

for secret_name in "${SECRETS[@]}"; do
  # Read value from env file
  value=$(grep "^${secret_name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
  
  if [ -z "$value" ]; then
    echo "  ⚠️  SKIP: $secret_name (not found in $ENV_FILE)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  
  # Check if secret already exists
  if gcloud secrets describe "$secret_name" --project="$GCP_PROJECT" &>/dev/null; then
    echo "  ↻  UPDATE: $secret_name"
    echo -n "$value" | gcloud secrets versions add "$secret_name" \
      --project="$GCP_PROJECT" \
      --data-file=-
    UPDATED=$((UPDATED + 1))
  else
    echo "  +  CREATE: $secret_name"
    echo -n "$value" | gcloud secrets create "$secret_name" \
      --project="$GCP_PROJECT" \
      --replication-policy=automatic \
      --data-file=-
    CREATED=$((CREATED + 1))
  fi
done

echo ""
echo "============================================"
echo "Secret Manager setup complete!"
echo "  Created: $CREATED"
echo "  Updated: $UPDATED"
echo "  Skipped: $SKIPPED"
echo ""

# Grant Cloud Run service account access to secrets
SA_EMAIL=$(gcloud iam service-accounts list \
  --project="$GCP_PROJECT" \
  --filter="displayName:Compute Engine default" \
  --format="value(email)" | head -1)

if [ -n "$SA_EMAIL" ]; then
  echo ">>> Granting Secret Manager access to $SA_EMAIL"
  for secret_name in "${SECRETS[@]}"; do
    gcloud secrets add-iam-policy-binding "$secret_name" \
      --project="$GCP_PROJECT" \
      --member="serviceAccount:$SA_EMAIL" \
      --role="roles/secretmanager.secretAccessor" \
      --quiet 2>/dev/null || true
  done
  echo "  Done."
fi

echo ""
echo ">>> Next: run ./05-cloud-storage.sh"
echo "============================================"
