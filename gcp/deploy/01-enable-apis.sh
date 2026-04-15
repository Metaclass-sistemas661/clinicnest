#!/bin/bash
# ============================================================
# Step 1: Enable all required GCP APIs
# Project: sistema-de-gestao-16e15
# ============================================================
set -euo pipefail

export GCP_PROJECT="sistema-de-gestao-16e15"

echo ">>> Setting project to $GCP_PROJECT"
gcloud config set project "$GCP_PROJECT"

echo ">>> Enabling required APIs..."

APIS=(
  # Core
  "sqladmin.googleapis.com"              # Cloud SQL Admin
  "sql-component.googleapis.com"         # Cloud SQL
  "run.googleapis.com"                   # Cloud Run
  "cloudbuild.googleapis.com"            # Cloud Build
  "artifactregistry.googleapis.com"      # Artifact Registry (container images)
  "secretmanager.googleapis.com"         # Secret Manager
  "storage.googleapis.com"              # Cloud Storage
  "cloudscheduler.googleapis.com"        # Cloud Scheduler (cron)
  "cloudtasks.googleapis.com"            # Cloud Tasks (async)
  
  # Firebase
  "firebase.googleapis.com"              # Firebase
  "identitytoolkit.googleapis.com"       # Firebase Auth
  "firestore.googleapis.com"             # Firestore (realtime replacement)
  "fcm.googleapis.com"                   # Firebase Cloud Messaging
  
  # AI
  "aiplatform.googleapis.com"            # Vertex AI
  
  # Networking & Monitoring
  "vpcaccess.googleapis.com"             # Serverless VPC Access
  "compute.googleapis.com"               # Compute Engine (VPC)
  "monitoring.googleapis.com"            # Cloud Monitoring
  "logging.googleapis.com"               # Cloud Logging
  "cloudtrace.googleapis.com"            # Cloud Trace
)

for api in "${APIS[@]}"; do
  echo "  Enabling $api..."
  gcloud services enable "$api" --project="$GCP_PROJECT" 2>/dev/null || true
done

echo ""
echo ">>> All APIs enabled."
echo ">>> Next: run ./02-cloud-sql.sh"
