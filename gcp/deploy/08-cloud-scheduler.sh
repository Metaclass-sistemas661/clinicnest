#!/bin/bash
# ============================================================
# Step 8: Cloud Scheduler — Cron Jobs
# Project: sistema-de-gestao-16e15
# ============================================================
set -euo pipefail

export GCP_PROJECT="sistema-de-gestao-16e15"
export GCP_REGION="southamerica-east1"

echo ">>> Step 8: Cloud Scheduler (Cron Jobs)"

# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe clinicnest-api \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT" \
  --format="value(status.url)" 2>/dev/null || echo "https://clinicnest-api-XXXXX-rj.a.run.app")

# Get CRON_SECRET from Secret Manager
CRON_SECRET=$(gcloud secrets versions access latest \
  --secret=CRON_SECRET \
  --project="$GCP_PROJECT" 2>/dev/null || echo "REPLACE_WITH_CRON_SECRET")

echo "  Cloud Run URL: $SERVICE_URL"
echo ""

# ── Cron Job definitions ─────────────────────────────────────────────────
# Format: name|schedule|endpoint|description
CRON_JOBS=(
  "automation-worker|*/5 * * * *|/api/internal/automation-worker|Run automation rules every 5 min"
  "weekly-financial-summary|0 8 * * 1|/api/internal/send-weekly-financial-summary|Monday 8am financial summary"
  "ai-weekly-summary|0 8 * * 0|/api/internal/ai-weekly-summary|Sunday 8am AI weekly report"
  "notify-invoice-due|0 9 * * *|/api/internal/notify-patient-invoice-due|Daily 9am invoice reminders"
  "waitlist-auto-book|*/15 * * * *|/api/internal/waitlist-auto-book|Check waitlist every 15 min"
  "run-campaign|0 10 * * *|/api/internal/run-campaign|Daily 10am scheduled campaigns"
)

echo ">>> Creating ${#CRON_JOBS[@]} cron jobs..."
echo ""

for job in "${CRON_JOBS[@]}"; do
  IFS='|' read -r name schedule endpoint description <<< "$job"
  
  echo "  Creating: $name ($schedule)"
  
  gcloud scheduler jobs create http "$name" \
    --project="$GCP_PROJECT" \
    --location="$GCP_REGION" \
    --schedule="$schedule" \
    --uri="${SERVICE_URL}${endpoint}" \
    --http-method=POST \
    --headers="Content-Type=application/json,x-secret-key=$CRON_SECRET" \
    --body='{}' \
    --time-zone="America/Sao_Paulo" \
    --description="$description" \
    --attempt-deadline=300s \
    --max-retry-attempts=3 \
    --min-backoff-duration=30s \
    --max-backoff-duration=300s \
    --max-doublings=3 \
    --quiet 2>/dev/null || {
      echo "    (already exists, updating...)"
      gcloud scheduler jobs update http "$name" \
        --project="$GCP_PROJECT" \
        --location="$GCP_REGION" \
        --schedule="$schedule" \
        --uri="${SERVICE_URL}${endpoint}" \
        --http-method=POST \
        --headers="Content-Type=application/json,x-secret-key=$CRON_SECRET" \
        --body='{}' \
        --time-zone="America/Sao_Paulo" \
        --description="$description" \
        --quiet 2>/dev/null || true
    }
done

echo ""
echo "============================================"
echo "Cloud Scheduler setup complete!"
echo "  ${#CRON_JOBS[@]} cron jobs created"
echo "  Timezone: America/Sao_Paulo"
echo ""
echo "  To verify: gcloud scheduler jobs list --project=$GCP_PROJECT --location=$GCP_REGION"
echo "  To run manually: gcloud scheduler jobs run <job-name> --project=$GCP_PROJECT --location=$GCP_REGION"
echo ""
echo "============================================"
echo ""
echo ">>> MIGRATION COMPLETE!"
echo ">>> All 8 steps have been executed."
echo ""
echo ">>> Post-deploy checklist:"
echo "  1. Update frontend VITE_* env vars to point to Cloud Run URL"
echo "  2. Configure Firebase Auth providers in console"
echo "  3. Map custom domain: api.clinicnest.com.br → Cloud Run"
echo "  4. Map custom domain: clinicnest.com.br → Firebase Hosting"
echo "  5. Test /health endpoint"
echo "  6. Run smoke tests on critical paths: register, login, appointments"
echo "  7. Enable monitoring alerts in GCP Console"
echo "============================================"
