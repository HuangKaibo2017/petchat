#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./deploy-server.sh <user@host> [remote_path]"
  echo "Example: ./deploy-server.sh root@gengdongta.com /home/gengdongta/petchat"
  exit 1
fi

SERVER="$1"
REMOTE_PATH="${2:-/home/gengdongta/petchat}"
LOCAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Gengdongta Server Deployment ==="
echo ""
echo "Server:  $SERVER"
echo "Path:    $REMOTE_PATH"
echo ""

echo "[1/4] Syncing backend code..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '*.log' \
  "$LOCAL_ROOT/backend/" "$SERVER:$REMOTE_PATH/backend/"

echo ""
echo "[2/4] Syncing env files..."
rsync -avz \
  "$LOCAL_ROOT/.env.local" "$SERVER:$REMOTE_PATH/"

echo ""
echo "[3/4] Installing dependencies..."
ssh "$SERVER" "cd $REMOTE_PATH/backend && npm install --production"

echo ""
echo "[4/4] Restarting PM2..."
ssh "$SERVER" "cd $REMOTE_PATH && pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Verify with:"
echo "  curl https://www.gengdongta.com/api/health"
echo "  curl https://www.gengdongta.com/api/products"
