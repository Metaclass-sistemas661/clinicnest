#!/bin/bash
# ============================================================
# ClinicNest — GCP Infrastructure Setup
# Project: sistema-de-gestão-16e15
# App: clinicnest
# ============================================================
# 
# EXECUTION ORDER:
#   1. 01-enable-apis.sh       — Enable all required GCP APIs
#   2. 02-cloud-sql.sh         — Create Cloud SQL instance + database
#   3. 03-run-migrations.sh    — Execute all SQL migrations in order
#   4. 04-secret-manager.sh    — Create all secrets
#   5. 05-cloud-storage.sh     — Create storage buckets
#   6. 06-cloud-run-deploy.sh  — Build and deploy all Cloud Run services
#   7. 07-firebase-setup.sh    — Configure Firebase Auth
#   8. 08-cloud-scheduler.sh   — Set up cron jobs
#
# PRE-REQUISITES:
#   - gcloud CLI installed and authenticated
#   - Docker installed (for Cloud Run builds)
#   - Cloud SQL Auth Proxy (for local migrations)
#   - .env.secrets file populated with real values
# ============================================================

export GCP_PROJECT="sistema-de-gestao-16e15"
export GCP_REGION="southamerica-east1"
export APP_NAME="clinicnest"

echo "============================================"
echo "ClinicNest — GCP Migration Deployment"
echo "Project: $GCP_PROJECT"
echo "Region:  $GCP_REGION"
echo "App:     $APP_NAME"
echo "============================================"
echo ""
echo "Run scripts in order:"
echo "  ./01-enable-apis.sh"
echo "  ./02-cloud-sql.sh"
echo "  ./03-run-migrations.sh"
echo "  ./04-secret-manager.sh"
echo "  ./05-cloud-storage.sh"
echo "  ./06-cloud-run-deploy.sh"
echo "  ./07-firebase-setup.sh"
echo "  ./08-cloud-scheduler.sh"
