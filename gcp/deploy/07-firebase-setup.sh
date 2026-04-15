#!/bin/bash
# ============================================================
# Step 7: Firebase Auth + Hosting Setup
# Project: sistema-de-gestao-16e15
# ============================================================
set -euo pipefail

export GCP_PROJECT="sistema-de-gestao-16e15"
export GCP_REGION="southamerica-east1"

echo ">>> Step 7: Firebase Auth + Hosting Setup"

# ── 1. Initialize Firebase project ──────────────────────────────────────
echo ">>> Linking Firebase to GCP project..."
firebase projects:addfirebase "$GCP_PROJECT" 2>/dev/null || echo "  (already linked)"

# ── 2. Create web app ───────────────────────────────────────────────────
echo ""
echo ">>> Creating Firebase web app 'clinicnest'..."
firebase apps:create web "clinicnest" --project="$GCP_PROJECT" 2>/dev/null || echo "  (already exists)"

# Get web app config
echo ""
echo ">>> Firebase web app config:"
firebase apps:sdkconfig web --project="$GCP_PROJECT" 2>/dev/null || true

# ── 3. Enable Auth providers ────────────────────────────────────────────
echo ""
echo ">>> Configuring Firebase Auth providers..."
echo "  NOTE: Firebase Auth provider configuration must be done via Firebase Console:"
echo ""
echo "  1. Go to: https://console.firebase.google.com/project/$GCP_PROJECT/authentication/providers"
echo "  2. Enable 'Email/Password' (with email link sign-in optional)"
echo "  3. Enable 'Phone' auth if needed for patient SMS verification"
echo "  4. Configure authorized domains:"
echo "     - clinicnest.com.br"
echo "     - www.clinicnest.com.br"
echo "     - app.clinicnest.com.br"
echo "     - localhost (for development)"
echo ""

# ── 4. Firebase Hosting setup ───────────────────────────────────────────
echo ">>> Setting up Firebase Hosting..."

# The firebase.json should already exist from the frontend project
# Verify and update if needed
if [ ! -f "../../firebase.json" ]; then
  echo "  Creating firebase.json..."
  cat > ../../firebase.json << 'EOF'
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|map)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=604800" }
        ]
      },
      {
        "source": "/manifest.json",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=86400" }
        ]
      }
    ]
  },
  "emulators": {
    "hosting": { "port": 5000 },
    "auth": { "port": 9099 }
  }
}
EOF
fi

# ── 5. Firebase Cloud Messaging setup ───────────────────────────────────
echo ""
echo ">>> FCM (Push Notifications) setup:"
echo "  NOTE: Configure via Firebase Console:"
echo "  1. Go to: https://console.firebase.google.com/project/$GCP_PROJECT/messaging"
echo "  2. Generate server key (or use FCM v1 with service account)"
echo "  3. Store key as: gcloud secrets create FCM_SERVER_KEY --data-file=-"
echo ""
echo "  The frontend Service Worker is at: public/firebase-messaging-sw.js"
echo "  Update the config with your Firebase web app credentials."
echo ""

# ── 6. Deploy to Firebase Hosting ───────────────────────────────────────
echo ">>> To deploy frontend to Firebase Hosting:"
echo "  1. Build frontend:  npm run build"
echo "  2. Deploy:          firebase deploy --only hosting --project=$GCP_PROJECT"
echo ""

# ── 7. Custom domain ────────────────────────────────────────────────────
echo ">>> Custom domain setup:"
echo "  1. Go to Firebase Console → Hosting → Add custom domain"
echo "  2. Add: clinicnest.com.br"
echo "  3. Add: www.clinicnest.com.br"
echo "  4. Follow DNS verification steps"
echo ""

echo "============================================"
echo "Firebase setup guide complete!"
echo ""
echo ">>> Next: run ./08-cloud-scheduler.sh"
echo "============================================"
