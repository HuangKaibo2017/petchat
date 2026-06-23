#!/bin/bash
# PetChat 一键启动脚本
# Usage: ./start.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🐾 更懂它 - 启动中..."

# 1. Ensure MySQL is running
echo "  检查 MySQL..."
if ! node -e "
  const m=require('$DIR/backend/node_modules/mysql2/promise');
  m.createConnection({socketPath:'/tmp/mysql_petchat.sock',user:'root',password:'',database:'gengdongta_dev'})
    .then(c=>{c.query('SELECT 1').then(()=>{console.log('OK');c.end();process.exit(0)}).catch(()=>process.exit(1))})
    .catch(()=>process.exit(1));
" 2>/dev/null; then
  echo "  MySQL 未运行，正在通过 brew services 启动..."
  brew services start mysql 2>/dev/null || true
  sleep 3
fi

# 2. Apply schema / migrations (idempotent — CREATE TABLE IF NOT EXISTS)
echo "  应用数据库 schema..."
node -e "
  const fs=require('fs');
  const m=require('$DIR/backend/node_modules/mysql2/promise');
  const files=[
    '$DIR/database/mysql_schema.sql',
    '$DIR/database/migrations/20260623_add_report_constitution_medical.sql',
  ];
  (async()=>{
    const c=await m.createConnection({socketPath:'/tmp/mysql_petchat.sock',user:'root',password:'',database:'gengdongta_dev',multipleStatements:true});
    for(const f of files){ if(fs.existsSync(f)){ await c.query(fs.readFileSync(f,'utf8')); } }
    await c.end();
    console.log('  schema OK');
  })().catch(e=>{console.warn('  schema 应用失败（可忽略，如表已存在）:',e.message);process.exit(0)});
" 2>/dev/null || echo "  （跳过 schema 应用）"

# 3. Start backend
echo "  启动后端..."
cd "$DIR/backend"
node server.js
