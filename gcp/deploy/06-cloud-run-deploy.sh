#!/bin/bash
# ============================================================
# Step 6: Deploy Cloud Run service
# Project: sistema-de-gestao-16e15
# ============================================================
set -euo pipefail

export GCP_PROJECT="sistema-de-gestao-16e15"
export GCP_REGION="southamerica-east1"
export SERVICE_NAME="clinicnest-api"
export CLOUD_RUN_SA="clinicnest-api@${GCP_PROJECT}.iam.gserviceaccount.com"
export VPC_CONNECTOR="clinicnest-connector"

CLOUD_RUN_DIR="$(cd "$(dirname "$0")/../cloud-run" && pwd)"

echo ">>> Step 6: Deploy Cloud Run service"
echo "    Source: $CLOUD_RUN_DIR"
echo "    Service: $SERVICE_NAME"
echo ""

# ── 1. Create Cloud Run Service Account ──────────────────────────────────
echo ">>> Creating service account..."
gcloud iam service-accounts create clinicnest-api \
  --display-name="ClinicNest API Service" \
  --project="$GCP_PROJECT" 2>/dev/null || echo "  (already exists)"

# Grant necessary roles
ROLES=(
  "roles/cloudsql.client"
  "roles/secretmanager.secretAccessor"
  "roles/storage.objectAdmin"
  "roles/aiplatform.user"
  "roles/logging.logWriter"
  "roles/monitoring.metricWriter"
  "roles/cloudtrace.agent"
  "roles/firebase.sdkAdminServiceAgent"
)

for role in "${ROLES[@]}"; do
  echo "  Granting $role"
  gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
    --member="serviceAccount:$CLOUD_RUN_SA" \
    --role="$role" \
    --quiet 2>/dev/null || true
done

# ── 2. Build Docker image ────────────────────────────────────────────────
echo ""
echo ">>> Building Docker image via Cloud Build..."

cd "$CLOUD_RUN_DIR"

# Install dependencies and build TypeScript
npm ci
npm run build

# Build and push via Cloud Build (Artifact Registry)
REPO="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/clinicnest/$SERVICE_NAME"

# Create Artifact Registry repository
gcloud artifacts repositories create clinicnest \
  --repository-format=docker \
  --location="$GCP_REGION" \
  --project="$GCP_PROJECT" 2>/dev/null || echo "  (registry exists)"

# Build using Cloud Build
gcloud builds submit \
  --tag="$REPO:latest" \
  --project="$GCP_PROJECT" \
  --timeout=600s

# ── 3. Prepare Secret references ─────────────────────────────────────────
echo ""
echo ">>> Preparing secret environment variables..."

# Core secrets to mount as env vars in Cloud Run
SECRETS=(
  "CLOUDSQL_CONNECTION_STRING=CLOUDSQL_CONNECTION_STRING:latest"
  "GCP_SERVICE_ACCOUNT_KEY=GCP_SERVICE_ACCOUNT_KEY:latest"
  "FIREBASE_SERVICE_ACCOUNT_KEY=FIREBASE_SERVICE_ACCOUNT_KEY:latest"
  "RESEND_API_KEY=RESEND_API_KEY:latest"
  "UPSTASH_REDIS_REST_URL=UPSTASH_REDIS_REST_URL:latest"
  "UPSTASH_REDIS_REST_TOKEN=UPSTASH_REDIS_REST_TOKEN:latest"
  "TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest"
  "TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest"
  "TWILIO_API_KEY_SID=TWILIO_API_KEY_SID:latest"
  "TWILIO_API_KEY_SECRET=TWILIO_API_KEY_SECRET:latest"
  "EVOLUTION_API_URL=EVOLUTION_API_URL:latest"
  "EVOLUTION_API_KEY=EVOLUTION_API_KEY:latest"
  "EVOLUTION_SALES_API_URL=EVOLUTION_SALES_API_URL:latest"
  "EVOLUTION_SALES_API_KEY=EVOLUTION_SALES_API_KEY:latest"
  "ASAAS_API_KEY=ASAAS_API_KEY:latest"
  "STRIPE_API_KEY=STRIPE_API_KEY:latest"
  "RNDS_API_KEY=RNDS_API_KEY:latest"
  "CRON_SECRET=CRON_SECRET:latest"
  "FCM_SERVER_KEY=FCM_SERVER_KEY:latest"
)

SECRET_ARGS=""
for s in "${SECRETS[@]}"; do
  SECRET_ARGS="$SECRET_ARGS --set-secrets=$s"
done

# ── 4. Deploy to Cloud Run ───────────────────────────────────────────────
echo ""
echo ">>> Deploying to Cloud Run..."

# Cloud SQL instance connection name
CLOUD_SQL_CONN="${GCP_PROJECT}:${GCP_REGION}:clinicnest-db"

gcloud run deploy "$SERVICE_NAME" \
  --image="$REPO:latest" \
  --platform=managed \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT" \
  --service-account="$CLOUD_RUN_SA" \
  --vpc-connector="$VPC_CONNECTOR" \
  --vpc-egress=private-ranges-only \
  --add-cloudsql-instances="$CLOUD_SQL_CONN" \
  --port=8080 \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300s \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=$GCP_PROJECT,GCP_REGION=$GCP_REGION,GEMINI_MODEL=gemini-2.0-flash" \
  --set-env-vars="SITE_URL=https://clinicnest.com.br,PUBLIC_SITE_URL=https://clinicnest.com.br" \
  --set-env-vars="EMAIL_FROM=ClinicNest <no-reply@clinicnest.com.br>" \
  --set-env-vars="ASAAS_API_BASE_URL=https://api.asaas.com/v3" \
  --set-env-vars="RNDS_ENVIRONMENT=producao" \
  $SECRET_ARGS \
  --allow-unauthenticated \
  --quiet

# ── 5. Get service URL ───────────────────────────────────────────────────
echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT" \
  --format="value(status.url)")

echo "============================================"
echo "Cloud Run deployment complete!"
echo "  Service URL: $SERVICE_URL"
echo "  Health: ${SERVICE_URL}/health"
echo ""
echo ">>> Update FRONTEND_URL env var to your domain"
echo ">>> Map custom domain via:"
echo "  gcloud beta run domain-mappings create --service=$SERVICE_NAME --domain=api.clinicnest.com.br --region=$GCP_REGION"
echo ""
echo ">>> Next: run ./07-firebase-setup.sh"
echo "============================================"
