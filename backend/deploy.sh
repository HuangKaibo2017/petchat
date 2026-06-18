#!/bin/bash
# Gengdongta Backend Deployment Script
# Usage: ./deploy.sh <supabase-project-ref>
#
# Prerequisites:
#   1. Install Supabase CLI: brew install supabase/tap/supabase
#   2. Login: supabase login
#   3. Link project: supabase link --project-ref <ref>

set -euo pipefail

PROJECT_REF="${1:-}"
if [ -z "$PROJECT_REF" ]; then
  echo "Usage: ./deploy.sh <supabase-project-ref>"
  echo "Example: ./deploy.sh abcdefghijklm"
  exit 1
fi

echo "=== Gengdongta Backend Deployment ==="
echo "Project: $PROJECT_REF"
echo ""

# Navigate to supabase directory
cd "$(dirname "$0")/supabase"

# 1. Push database migrations
echo "[1/4] Pushing migrations..."
supabase db push --linked --project-ref "$PROJECT_REF" || {
  echo "WARNING: db push may need --linked flag. Trying alternative..."
  psql -h "db.${PROJECT_REF}.supabase.co" \
       -d postgres \
       -U postgres \
       -f migrations/20260618_rls_policies.sql
}

# 2. Run seed data
echo "[2/4] Seeding data..."
supabase db push --linked --project-ref "$PROJECT_REF" || true

# 3. Deploy Edge Functions
echo "[3/4] Deploying Edge Functions..."
FUNCTIONS=("wechat-auth" "upload" "emotion-report" "health-report" "risk-report" "chat")
for fn in "${FUNCTIONS[@]}"; do
  echo "  Deploying $fn..."
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

# 4. Set secrets (prompt user)
echo "[4/4] Setting environment secrets..."
echo ""
echo "Please enter the following secrets (or set them manually via Supabase Dashboard):"
echo ""

read -p "WECHAT_APPID: " WECHAT_APPID
read -p "WECHAT_SECRET: " WECHAT_SECRET
read -p "AI_API_KEY: " AI_API_KEY
read -p "AI_BASE_URL (default: https://api.openai.com/v1): " AI_BASE_URL
AI_BASE_URL="${AI_BASE_URL:-https://api.openai.com/v1}"
read -p "AI_MODEL (default: gpt-4o-mini): " AI_MODEL
AI_MODEL="${AI_MODEL:-gpt-4o-mini}"

supabase secrets set \
  WECHAT_APPID="$WECHAT_APPID" \
  WECHAT_SECRET="$WECHAT_SECRET" \
  AI_API_KEY="$AI_API_KEY" \
  AI_BASE_URL="$AI_BASE_URL" \
  AI_MODEL="$AI_MODEL" \
  --project-ref "$PROJECT_REF"

echo ""
echo "=== Deployment Complete ==="
echo "Edge Function URLs:"
for fn in "${FUNCTIONS[@]}"; do
  echo "  https://${PROJECT_REF}.supabase.co/functions/v1/$fn"
done
echo ""
echo "Next: Update wechat/utils/api.js with the Supabase project URL"
