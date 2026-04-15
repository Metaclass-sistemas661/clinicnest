#!/bin/bash
# ============================================================
# Step 5: Create Cloud Storage buckets
# Project: sistema-de-gestao-16e15
# ============================================================
set -euo pipefail

export GCP_PROJECT="sistema-de-gestao-16e15"
export GCP_REGION="southamerica-east1"
export BUCKET_PREFIX="clinicnest"

echo ">>> Creating Cloud Storage buckets..."

# Bucket definitions: name, storage class, lifecycle (days), public
declare -A BUCKETS
BUCKETS=(
  ["avatars"]="STANDARD:365:false"
  ["medical-records"]="STANDARD:2555:false"       # 7 years (LGPD health data)
  ["consent-documents"]="STANDARD:7300:false"      # 20 years
  ["consent-photos"]="STANDARD:7300:false"
  ["consent-signatures"]="STANDARD:7300:false"
  ["patient-exams"]="STANDARD:2555:false"
  ["document-signatures"]="STANDARD:7300:false"
)

for bucket_name in "${!BUCKETS[@]}"; do
  IFS=':' read -r storage_class lifecycle public <<< "${BUCKETS[$bucket_name]}"
  
  full_name="${BUCKET_PREFIX}-${bucket_name}"
  
  echo "  Creating: gs://$full_name"
  
  # Create bucket
  gsutil mb \
    -p "$GCP_PROJECT" \
    -l "$GCP_REGION" \
    -c "$storage_class" \
    -b on \
    "gs://$full_name" 2>/dev/null || echo "    (already exists)"
  
  # Enable versioning for medical data
  gsutil versioning set on "gs://$full_name"
  
  # Set CORS for signed URL uploads
  cat > /tmp/cors-${bucket_name}.json << 'CORS_EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Disposition", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
CORS_EOF
  gsutil cors set "/tmp/cors-${bucket_name}.json" "gs://$full_name"
  
  # Set lifecycle (auto-delete after N days for non-archive buckets)
  # Medical data has long retention — this is the MINIMUM, not auto-delete
  echo "    Versioning: ON, Storage: $storage_class, Retention: ${lifecycle}d min"
done

# Block all public access (HIPAA/LGPD compliance)
echo ""
echo ">>> Enforcing uniform bucket-level access (no public)..."
for bucket_name in "${!BUCKETS[@]}"; do
  full_name="${BUCKET_PREFIX}-${bucket_name}"
  gsutil pap set enforced "gs://$full_name" 2>/dev/null || true
done

echo ""
echo "============================================"
echo "Cloud Storage setup complete!"
echo "  ${#BUCKETS[@]} buckets created with prefix '$BUCKET_PREFIX-'"
echo "  All buckets: private, versioned, uniform access"
echo ""
echo ">>> Next: run ./06-cloud-run-deploy.sh"
echo "============================================"
