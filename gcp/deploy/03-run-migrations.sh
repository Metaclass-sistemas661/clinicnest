#!/bin/bash
# ============================================================
# Step 3: Run all SQL migrations in correct order
# Requires: Cloud SQL Auth Proxy running locally
# ============================================================
set -euo pipefail

export DB_HOST="${DB_HOST:-127.0.0.1}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-clinicnest}"
export DB_USER="${DB_USER:-clinicnest_admin}"

echo ">>> Running ClinicNest GCP migrations..."
echo ">>> Target: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Migration execution order — domains must be applied in this sequence
# to respect foreign key dependencies
MIGRATION_ORDER=(
  "000_extensions"         # pg_cron, pg_net, pgcrypto
  "001_foundation"         # enums, helpers, tenants, profiles, core
  "002_clinical"           # appointments, records, treatments
  "003_financial"          # charges, invoices, commissions
  "004_patient_portal"     # patient auth, portal features
  "005_inventory"          # products, stock, movements
  "006_odontology"         # dental-specific tables
  "007_compliance"         # LGPD, TISS, SNGPC, ONA
  "008_integrations"       # HL7, RNDS, external systems
  "009_ai_automation"      # AI usage, automation configs
  "010_communications"     # chat, notifications, campaigns
  "011_crm_loyalty"        # loyalty program, health credits
  "012_storage_buckets"    # storage bucket configs
)

MIGRATIONS_DIR="../migrations"
TOTAL_FILES=0
ERRORS=0

for domain in "${MIGRATION_ORDER[@]}"; do
  domain_dir="$MIGRATIONS_DIR/$domain"
  
  if [ ! -d "$domain_dir" ]; then
    echo "  SKIP: $domain (directory not found)"
    continue
  fi
  
  echo ">>> Domain: $domain"
  
  # Execute SQL files in numeric order
  for sql_file in $(ls "$domain_dir"/*.sql 2>/dev/null | sort); do
    filename=$(basename "$sql_file")
    echo "  Executing: $filename..."
    
    if PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -f "$sql_file" \
      -v ON_ERROR_STOP=1 \
      --quiet 2>&1; then
      TOTAL_FILES=$((TOTAL_FILES + 1))
    else
      echo "  ❌ ERROR in $filename"
      ERRORS=$((ERRORS + 1))
      # Continue with next file — some errors may be expected (IF NOT EXISTS)
    fi
  done
  
  echo ""
done

echo "============================================"
echo "Migration complete!"
echo "  Files executed: $TOTAL_FILES"
echo "  Errors: $ERRORS"
echo ""
echo ">>> Next: run ./04-secret-manager.sh"
echo "============================================"
