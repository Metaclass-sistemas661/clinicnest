#!/bin/bash
# ============================================================
# Step 2: Create Cloud SQL PostgreSQL instance + database
# Project: sistema-de-gestao-16e15
# Instance: clinicnest-db
# Database: clinicnest
# ============================================================
set -euo pipefail

export GCP_PROJECT="sistema-de-gestao-16e15"
export GCP_REGION="southamerica-east1"
export INSTANCE_NAME="clinicnest-db"
export DB_NAME="clinicnest"
export DB_USER="clinicnest_admin"

# Read password from .env.secrets or prompt
if [ -f ".env.secrets" ]; then
  DB_PASSWORD=$(grep '^CLOUDSQL_DB_PASSWORD=' .env.secrets | cut -d'=' -f2)
fi
if [ -z "${DB_PASSWORD:-}" ]; then
  echo "Enter database password for user '$DB_USER':"
  read -s DB_PASSWORD
fi

echo ">>> Creating Cloud SQL PostgreSQL 15 instance: $INSTANCE_NAME"
gcloud sql instances create "$INSTANCE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-8192 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --availability-type=zonal \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=14 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --database-flags=\
log_min_duration_statement=1000,\
max_connections=200,\
shared_buffers=2048MB,\
work_mem=64MB,\
effective_cache_size=6144MB,\
pg_stat_statements.track=all,\
cloudsql.enable_pg_cron=on,\
cloudsql.enable_pgaudit=on

echo ">>> Creating database: $DB_NAME"
gcloud sql databases create "$DB_NAME" \
  --project="$GCP_PROJECT" \
  --instance="$INSTANCE_NAME" \
  --charset=UTF8 \
  --collation=en_US.UTF8

echo ">>> Creating user: $DB_USER"
gcloud sql users create "$DB_USER" \
  --project="$GCP_PROJECT" \
  --instance="$INSTANCE_NAME" \
  --password="$DB_PASSWORD"

echo ">>> Creating VPC connector for Cloud Run → Cloud SQL"
gcloud compute networks vpc-access connectors create clinicnest-vpc \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=10

# Get connection name for Cloud SQL Auth Proxy
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
  --project="$GCP_PROJECT" \
  --format='value(connectionName)')

echo ""
echo "============================================"
echo "Cloud SQL instance created!"
echo "  Instance: $INSTANCE_NAME"
echo "  Database: $DB_NAME"
echo "  User:     $DB_USER"
echo "  Connection: $CONNECTION_NAME"
echo ""
echo "Connection string for Cloud Run:"
echo "  postgresql://$DB_USER:<password>@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME"
echo ""
echo "For local access via Cloud SQL Auth Proxy:"
echo "  cloud-sql-proxy $CONNECTION_NAME"
echo "  psql -h 127.0.0.1 -U $DB_USER -d $DB_NAME"
echo ""
echo ">>> Next: run ./03-run-migrations.sh"
echo "============================================"
