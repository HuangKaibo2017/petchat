#!/bin/bash
# PetChat 一键启动脚本 — Supabase PostgreSQL (cloud)
# Usage: ./start.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🐾 更懂它 - 启动中..."
echo "  数据库: Supabase PostgreSQL (cloud)"

cd "$DIR/backend/src"
node server.js
