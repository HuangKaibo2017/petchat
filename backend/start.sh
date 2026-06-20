#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "🐾 启动 Gengdongta 后端…"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js 未安装，请先安装 Node.js 18+"
  exit 1
fi

# Check .env.local
if [ ! -f ../.env.local ]; then
  echo "⚠️  .env.local 未找到，复制 .env.example 并填入真实值"
  if [ -f ../.env.example ]; then
    cp ../.env.example ../.env.local
    echo "   已从 .env.example 创建 .env.local，请编辑填入密钥"
  fi
fi

# Check dependencies
if [ ! -d node_modules ]; then
  echo "📦 安装依赖…"
  npm install
fi

echo "🚀 启动服务 (端口: ${SERVER_PORT:-8001})"
node server.js
