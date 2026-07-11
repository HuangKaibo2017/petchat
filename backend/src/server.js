require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') })

const { createLogger } = require('./utils/logger')
const log = createLogger('app')

const express = require('express')
const app = express()
const PORT = process.env.SERVER_PORT || 8001

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  },
}))

const { setupCors } = require('./middleware/cors')
setupCors(app)

const { now } = require('./utils/common')
const { uuid, timestamp, yuanToFen } = require('./utils/common')
const { auth, optionalAuth, signJWT } = require('./middleware/auth')

const llm = require('./core/llm')
const memory = require('./core/memory')
const router = require('./core/router')
const agents = require('./agents/registry')

const db = require('./db/postgres')
const wechatPay = require('./payments/wechatPay')

require('./tools/health')

const sharedDeps = { db, agents, auth, optionalAuth, uuid, timestamp, now, yuanToFen, signJWT, memory, router, wechatPay }

app.use('/', require('./routes/reports')(sharedDeps))
app.use('/', require('./routes/wechat-auth')(sharedDeps))
app.use('/api/reports', require('./routes/history')(sharedDeps))
app.use('/api/favorites', require('./routes/favorites')(sharedDeps))
app.use('/api/pets', require('./routes/pets')(sharedDeps))
app.use('/api', require('./routes/shop')(sharedDeps))
app.use('/api/pay', require('./routes/payment')(sharedDeps))
app.use('/api/hospitals', require('./routes/hospitals')(sharedDeps))
app.use('/api/upload', require('./routes/upload')(sharedDeps))
app.use('/chat', require('./routes/chat')(sharedDeps))

app.use('/api/auth', require('./routes/admin/auth')(sharedDeps))
app.use('/api/admin', require('./routes/admin/products')(sharedDeps))
app.use('/api/admin', require('./routes/admin/orders')(sharedDeps))
app.use('/api/admin', require('./routes/admin/categories')(sharedDeps))
app.use('/api/admin', require('./routes/admin/dashboard')(sharedDeps))

app.get('/api/health', async (req, res) => {
  const dbOk = await db.ping()
  res.json({
    status: dbOk ? 'ok' : 'db_error',
    time: now(),
    llm: llm.available(),
    agents: agents.list(),
    sessions: memory.count(),
    db: dbOk ? 'connected' : 'disconnected',
  })
})

app.listen(PORT, () => {
  log.info('═══════════════════════════════════')
  log.info('  🐾 更懂它 后端已启动')
  log.info(`  📡 http://localhost:${PORT}`)
  log.info(`  🤖 DeepSeek 智能体: ${llm.available() ? '✅ 已连接' : '❌ 未配置'}`)
  log.info(`  🗄️  数据库: PostgreSQL (Supabase)`)
  log.info('═══════════════════════════════════')
  log.info('')
  log.info('  路由模块:')
  log.info('  POST /wechat-auth              微信登录')
  log.info('  POST /emotion-report           情绪解读')
  log.info('  POST /health-report            健康监测')
  log.info('  POST /risk-report              风险评估')
  log.info('  POST /constitution/report      体质分析')
  log.info('  POST /medical/guide            医疗科普')
  log.info('  POST /chat/send-json           AI 聊天')
  log.info('  GET  /api/health               健康检查')
  log.info('')
})
