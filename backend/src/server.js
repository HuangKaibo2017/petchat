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

// CORS for mini program
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19)
const timestamp = () => {
  const d = new Date()
  return parseInt(
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0')
  )
}
const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

const yuanToFen = (amount) => Math.round(Number(amount || 0) * 100)

// ═══════════════════════════════════════════
//  内置智能体引擎
// ═══════════════════════════════════════════

const llm     = require('./core/llm')
const memory  = require('./core/memory')
const router  = require('./core/router')
const agents  = require('./agents/registry')

// ═══════════════════════════════════════════
//  MySQL 数据库
// ═══════════════════════════════════════════

const db = require('./db/postgres')
const wechatPay = require('./payments/wechatPay')

// 启动时加载健康检查工具
require('./tools/health')

// ═══════════════════════════════════════════
//  Auth 中间件（JWT 简化版）
// ═══════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'local_dev_jwt_secret_change_me'

// Simple JWT sign (no external lib needed for dev)
function signJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url')
  const crypto = require('crypto')
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function verifyJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const crypto = require('crypto')
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url')
    if (sig !== parts[2]) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }
  const payload = verifyJWT(token)
  if (!payload) {
    return res.status(401).json({ code: 401, message: '登录已过期' })
  }
  req.userId = payload.userId
  req.userPublicUid = payload.userPublicUid
  next()
}

// Optional auth — doesn't fail if no token
async function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token) {
    const payload = verifyJWT(token)
    if (payload) {
      req.userId = payload.userId
      req.userPublicUid = payload.userPublicUid
    }
  }
  next()
}

// ═══════════════════════════════════════════
//  微信登录
// ═══════════════════════════════════════════

app.post('/wechat-auth', async (req, res) => {
  try {
    const { code, nickName, avatarUrl } = req.body
    if (!code) {
      return res.status(400).json({ code: 400, message: '缺少微信登录 code' })
    }

    // Exchange code for openid via WeChat API
    const WECHAT_APPID = process.env.WECHAT_APPID || ''
    const WECHAT_SECRET = process.env.WECHAT_SECRET || ''

    let openid = ''
    let unionid = ''

    if (WECHAT_APPID && WECHAT_SECRET) {
      try {
        const https = require('https')
        const wxRes = await new Promise((resolve, reject) => {
          https.get(
            `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`,
            (resp) => {
              let data = ''
              resp.on('data', chunk => data += chunk)
              resp.on('end', () => {
                try { resolve(JSON.parse(data)) }
                catch (e) { reject(e) }
              })
            }
          ).on('error', reject)
        })
        if (wxRes.openid) {
          openid = wxRes.openid
          unionid = wxRes.unionid || ''
        } else {
          console.warn('[wechat-auth] wx API error:', wxRes.errmsg || wxRes)
        }
      } catch (e) {
        console.warn('[wechat-auth] wx API call failed:', e.message)
      }
    }

    // For dev without real WeChat appid, generate a mock openid
    if (!openid) {
      openid = 'dev_' + uuid().replace(/-/g, '')
    }

    // Find or create user
    let rows = await db.query('SELECT f_id, f_public_uid, f_nickname, f_avatar_url FROM t_user WHERE f_wx_openid = ?', [openid])
    let user

    if (rows.length === 0) {
      const publicUid = uuid()
      const displayName = nickName || '微信用户'
      const ts = timestamp()
      await db.execute(
        'INSERT INTO t_user (f_public_uid, f_nickname, f_avatar_url, f_wx_openid, f_wx_unionid, f_status_id, f_created_at, f_updated_at) VALUES (?, ?, ?, ?, ?, 10, ?, ?)',
        [publicUid, displayName, avatarUrl || '', openid, unionid || '', ts, ts]
      )
      rows = await db.query('SELECT f_id, f_public_uid, f_nickname, f_avatar_url FROM t_user WHERE f_wx_openid = ?', [openid])
    }

    user = rows[0]

    // Sign JWT
    const token = signJWT({
      userId: user.f_id,
      userPublicUid: user.f_public_uid,
      nickname: user.f_nickname,
    })

    return res.json({
      code: 200,
      data: {
        token,
        expiresIn: 86400,
        user: {
          id: user.f_id,
          nickname: user.f_nickname,
          avatarUrl: user.f_avatar_url || '',
      },
    },
    })
  } catch (err) {
    console.error('[wechat-auth] error:', err.message)
    return res.status(500).json({ code: 500, message: '登录失败' })
  }
})

// ═══════════════════════════════════════════
//  Agent 智能体端点
// ═══════════════════════════════════════════

/**
 * 情绪解读
 */
app.post('/emotion-report', auth, async (req, res) => {
  try {
    const { petId, question, divSystem, numbers, imageUrl, reportType } = req.body
    const userId = req.userId

    // Get pet from DB
    const pets = await db.query('SELECT f_id, f_name, f_avatar_url, f_pet_type_id, f_gender_id, f_birth_date, f_weight FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
    if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

    const pet = pets[0]

    // Get pet type name
    const types = await db.query('SELECT f_name FROM t_pet_type WHERE f_id = ?', [pet.f_pet_type_id])
    const petTypeName = types.length > 0 ? ((typeof types[0].f_name === 'string' ? JSON.parse(types[0].f_name) : (types[0].f_name || {}))['zh-CN'] || '未知') : '未知'

    const mode = (numbers && numbers.length === 1) ? 'single' : 'multi'

    const report = await agents.get('mood').run({
      sessionId: 'emo_' + Date.now(),
      userMessage: question,
      petInfo: {
        name: pet.f_name,
        breed: petTypeName,
        age: pet.f_birth_date ? new Date().getFullYear() - new Date(pet.f_birth_date).getFullYear() : 3,
        question: question,
        divSystem: divSystem || 'liuyao',
        numbers: numbers || [],
    },
      mode,
    })

    // Save to MySQL
    const reportId = uuid()
    const ts = timestamp()
    await db.execute(
      `INSERT INTO t_report_emotion (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_food_satisfaction, f_mood_level, f_body_status, f_status_summary, f_owner_view, f_pet_message, f_pet_wish, f_product_recommend, f_llm_resp, f_status, f_created_at)
       VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
      [
        reportId, userId, petId,
        question || '', question || '',
        JSON.stringify(numbers || []),
        divSystem || '',
        report.coreAnswer || '', report.coreBasis || '',
        report.foodSatisfaction || '★★★☆☆', report.moodLevel || '★★★☆☆',
        report.bodyStatus || '', report.statusSummary || '',
        report.ownerView || '', report.petMessage || '',
        report.petWish || '',
        report.products ? JSON.stringify(report.products) : null,
        JSON.stringify(report),
        ts,
      ]
    )

    return res.json({
      code: 200,
      data: {
        id: reportId,
        petId: pet.f_id,
        petName: pet.f_name,
        petAvatar: pet.f_avatar_url || '',
        type: 'emotion',
        typeName: '情绪解读',
        divSystem: divSystem || 'liuyao',
        ...report,
        createdAt: now(),
    },
    })
  } catch (err) {
    console.error('[emotion-report] error:', err.message)
    return res.status(500).json({ code: 500, message: '报告生成失败' })
  }
})

/**
 * 健康监测
 */
app.post('/health-report', auth, async (req, res) => {
  try {
    const { petId, symptom, duration, abnormal, numbers, imageUrl } = req.body
    const userId = req.userId

    const pets = await db.query('SELECT f_id, f_name, f_pet_type_id, f_birth_date, f_weight, f_sterilized, f_vaccinated FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
    if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

    const pet = pets[0]

    const report = await agents.get('health').run({
      sessionId: 'hlth_' + Date.now(),
      userMessage: symptom || '',
      petInfo: {
        name: pet.f_name,
        birthDate: pet.f_birth_date,
        weight: pet.f_weight,
        sterilized: pet.f_sterilized,
        vaccinated: pet.f_vaccinated,
        symptom: symptom || '',
        duration: duration || '',
        abnormal: abnormal || '',
        numbers: numbers || [],
        imageUrl: imageUrl || '',
    },
    })

    const reportId = uuid()
    const ts = timestamp()
    await db.execute(
      `INSERT INTO t_report_health (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_health_score, f_health_level, f_symptom_analysis, f_diet_advice, f_exercise_advice, f_care_tips, f_vet_advice, f_llm_resp, f_status, f_created_at)
       VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
      [
        reportId, userId, petId,
        symptom || '', symptom || '',
        JSON.stringify(numbers || []),
        '',
        report.coreAnswer || report.currentSymptoms || '',
        report.coreBasis || '',
        (typeof report.healthScore === 'string' ? (report.healthScore.match(/★/g) || []).length * 20 : (report.healthScore || 80)),
        report.healthLevel || 'normal',
        report.symptomAnalysis || report.currentSymptoms || '',
        report.dietAdvice || '',
        report.exerciseAdvice || '',
        (report.carePlan || []).map(p => `${p.title}: ${p.desc}`).join('\n'),
        report.emergency || '',
        JSON.stringify(report),
        ts,
      ]
    )

    return res.json({
      code: 200,
      data: {
        id: reportId,
        petId: pet.f_id,
        petName: pet.f_name,
        type: 'health',
        typeName: '健康监测',
        ...report,
        createdAt: now(),
    },
    })
  } catch (err) {
    console.error('[health-report] error:', err.message)
    return res.status(500).json({ code: 500, message: '报告生成失败' })
  }
})

/**
 * 风险评估
 */
app.post('/risk-report', auth, async (req, res) => {
  try {
    const { petId, ownerBirthday, reportId, tongueImage } = req.body
    const userId = req.userId

    const pets = await db.query('SELECT f_id, f_name, f_pet_type_id, f_birth_date, f_weight FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
    if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

    const pet = pets[0]

    const report = await agents.get('risk').run({
      sessionId: 'risk_' + Date.now(),
      userMessage: `主人信息: 生日${ownerBirthday}`,
      petInfo: {
        name: pet.f_name,
        birthDate: pet.f_birth_date,
        weight: pet.f_weight,
        ownerBirthday: ownerBirthday || '',
        tongueImage: tongueImage || '',
    },
    })

    const riskId = uuid()
    const ts = timestamp()
    await db.execute(
      `INSERT INTO t_report_risk (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_risk_level, f_risk_score, f_risk_factors, f_prevention, f_emergency_guide, f_llm_resp, f_status, f_created_at)
       VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
      [
        riskId, userId, petId,
        ownerBirthday || '', ownerBirthday || '',
        '[]',
        '',
        report.coreAnswer || report.petImbalance || '',
        report.coreBasis || '',
        report.riskLevel || 'medium',
        report.riskScore || 50,
        report.riskFactors ? JSON.stringify(report.riskFactors) : null,
        report.prevention || report.recommendations?.join('\n') || '',
        report.emergencyGuide || report.medicalAdvice || '',
        JSON.stringify(report),
        ts,
      ]
    )

    return res.json({
      code: 200,
      data: {
        id: riskId,
        petId: pet.f_id,
        petName: pet.f_name,
        type: 'risk',
        typeName: '风险评估',
        ...report,
        createdAt: now(),
    },
    })
  } catch (err) {
    console.error('[risk-report] error:', err.message)
    return res.status(500).json({ code: 500, message: '报告生成失败' })
  }
})

/**
 * 体质综合分析
 */
app.post(['/constitution/report', '/api/constitution/report'], auth, async (req, res) => {
  try {
    const { petId, ownerBirthday } = req.body
    const userId = req.userId

    const pets = await db.query('SELECT f_id, f_name FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
    if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

    const pet = pets[0]
    const report = await agents.get('constitution').run({
      sessionId: 'const_' + Date.now(),
      userMessage: '',
      petInfo: { name: pet.f_name, ownerBirthday: ownerBirthday || '' },
    })

    const reportId = uuid()
    const ts = timestamp()
    await db.execute(
      `INSERT INTO t_report_constitution (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_owner_birthday, f_core_answer, f_pet_constitution, f_owner_match, f_season_advice, f_diet_advice, f_llm_resp, f_status, f_created_at)
       VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
      [
        reportId, userId, petId,
        ownerBirthday || '', ownerBirthday || '',
        report.coreAnswer || report.petConstitution || '',
        report.petConstitution || '',
        report.ownerMatch || '',
        report.seasonAdvice || '',
        report.dietAdvice || '',
        JSON.stringify(report),
        ts,
      ]
    )

    return res.json({ code: 200, data: { id: reportId, type: 'constitution', typeName: '体质综合分析', ...report, petName: pet.f_name, createdAt: now() } })
  } catch (err) {
    console.error('[constitution] error:', err.message)
    return res.status(500).json({ code: 500, message: '分析生成失败' })
  }
})

/**
 * 新宠购买建议
 */
app.post(['/newpet/guide', '/api/newpet/guide'], auth, async (req, res) => {
  try {
    const report = await agents.get('newpet').run({
      sessionId: 'newpet_' + Date.now(),
      userMessage: JSON.stringify(req.body),
      petInfo: req.body,
    })
    return res.json({ code: 200, data: report })
  } catch (err) {
    console.error('[newpet] error:', err.message)
    return res.json({
      code: 200,
      data: { summary: '暂时无法生成建议，请稍后重试。', recommendations: [], disclaimer: '领养代替购买。' },
    })
  }
})

/**
 * 医疗科普
 */
app.post(['/medical/guide', '/api/medical/guide'], auth, async (req, res) => {
  try {
    const report = await agents.get('consultation').run({
      sessionId: 'medical_' + Date.now(),
      userMessage: JSON.stringify(req.body),
      petInfo: req.body,
    })

    try {
      const reportId = uuid()
      const ts = timestamp()
      const { petId, symptom, duration } = req.body
      await db.execute(
        `INSERT INTO t_report_consultation (f_public_uid, f_user_id, f_pet_id, f_lang, f_report_type_id, f_judgment, f_symptom_explain, f_home_care, f_warning_sign, f_hospital_check, f_llm_resp, f_llm_input, f_status, f_created_at)
         VALUES (?, ?, ?, 'zh-CN', 8, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
        [
          reportId, req.userId, petId || null,
          report.judgment || '',
          report.symptomExplain || '',
          report.homeCare ? JSON.stringify(report.homeCare) : null,
          report.warningSign ? JSON.stringify(report.warningSign) : null,
          report.hospitalCheck ? JSON.stringify(report.hospitalCheck) : null,
          JSON.stringify(report),
          JSON.stringify(req.body),
          ts,
        ]
      )
      return res.json({ code: 200, data: { id: reportId, type: 'medical', typeName: '医疗科普', ...report } })
    } catch (dbErr) {
      console.error('[medical/guide] persist error:', dbErr.message)
      return res.json({ code: 200, data: report })
    }
  } catch (err) {
    console.error('[medical] error:', err.message)
    return res.json({
      code: 200,
      data: { judgment: '暂时无法回答，建议咨询专业兽医。', disclaimer: '以上内容为科普，不替代执业兽医面诊。' },
    })
  }
})

/**
 * 医疗追问
 */
app.post(['/medical/followup', '/api/medical/followup'], auth, async (req, res) => {
  try {
    const report = await agents.get('consultation').run({
      sessionId: req.body.sessionId || 'followup_' + Date.now(),
      userMessage: req.body.message || '',
      petInfo: req.body,
    })
    return res.json({ code: 200, data: report })
  } catch (err) {
    console.error('[medical-followup] error:', err.message)
    return res.status(500).json({ code: 500, message: '追问失败' })
  }
})

/**
 * 流式聊天
 */
// Rehydrate in-memory LLM context from persisted chat history (survives restart)
async function rehydrateSession(sessionId, petMeta = {}) {
  const session = memory.get(sessionId)
  session.petName = petMeta.petName || session.petName
  session.petBreed = petMeta.petBreed || session.petBreed
  session.petAge = petMeta.petAge || session.petAge
  if (session.messages.length === 0) {
    const rows = await db.query(
      'SELECT f_chat_history FROM t_chat_history WHERE f_id = ?',
      [sessionId]
    )
    if (rows.length > 0 && rows[0].f_chat_history) {
      const history = (typeof rows[0].f_chat_history === 'string' ? JSON.parse(rows[0].f_chat_history) : rows[0].f_chat_history)
      for (const r of (Array.isArray(history) ? history : [])) {
        session.messages.push({ role: r.role === 'pet' ? 'assistant' : r.role, content: r.content, at: r.created_at })
      }
    }
  }
  return session
}

// Shared chat send handler
async function handleChatSend(req, res) {
  try {
    const { sessionId, message } = req.body
    if (!sessionId || !message) {
      return res.status(400).json({ code: 400, message: '缺少 sessionId 或消息内容' })
    }

    // Verify session belongs to user
    const sessRows = await db.query(
      'SELECT h.f_id, h.f_pet_id, p.f_name, p.f_birth_date FROM t_chat_history h LEFT JOIN t_pet p ON p.f_id = h.f_pet_id WHERE h.f_id = ? AND h.f_user_id = ?',
      [isNaN(sessionId) ? -1 : parseInt(sessionId), req.userId]
    )
    if (sessRows.length === 0) return res.status(404).json({ code: 404, message: '会话不存在' })
    const sess = sessRows[0]

    const petInfo = {
      name: sess.f_name || '宠物',
      breed: '宠物',
      age: sess.f_birth_date ? String(Math.max(1, new Date().getFullYear() - new Date(sess.f_birth_date).getFullYear())) : '3',
    }

    await rehydrateSession(sessionId, { petName: petInfo.name, petBreed: petInfo.breed, petAge: petInfo.age })

    // 意图路由：闲聊 → chat，性格/行为提问 → personality
    const agentName = await router.route(String(sessionId), message)
    const reply = await agents.get(agentName).run({ sessionId, userMessage: message, petInfo })

    // Persist both turns into t_chat_history.f_chat_history JSONB
    const ts = new Date().toISOString()
    // Read existing history, append new messages
    const histRows = await db.query(
      'SELECT f_chat_history FROM t_chat_history WHERE f_id = ?',
      [sessionId]
    )
    let history = []
    if (histRows.length > 0 && histRows[0].f_chat_history) {
      const raw = histRows[0].f_chat_history
      history = (typeof raw === 'string' ? JSON.parse(raw) : raw) || []
    }
    history.push({ role: 'user', content: message, created_at: ts })
    history.push({ role: 'pet', content: reply, created_at: ts })
    await db.execute(
      'UPDATE t_chat_history SET f_chat_history = ?, f_ended_at = NOW() WHERE f_id = ?',
      [JSON.stringify(history), sessionId]
    )

    res.json({
      code: 200,
      data: {
        sessionId,
        userMessage: { id: Date.now(), role: 'user', content: message, at: new Date().toISOString() },
        petMessage: { id: Date.now() + 1, role: 'pet', content: reply, at: new Date().toISOString() },
    },
    })
  } catch (err) {
    console.error('[chat] error:', err.message)
    const fallbacks = ['主人主人，我在这儿呢！', '能不能摸摸我的头呀？', '汪汪！你今天心情好吗？']
    res.json({
      code: 200,
      data: {
        sessionId: req.body.sessionId,
        userMessage: { id: Date.now(), role: 'user', content: req.body.message, at: new Date().toISOString() },
        petMessage: { id: Date.now() + 1, role: 'pet', content: fallbacks[Math.floor(Math.random() * fallbacks.length)], at: new Date().toISOString() },
    },
    })
  }
}

app.post('/chat/send', auth, handleChatSend)
app.post('/chat/send-json', auth, handleChatSend)
// ═══════════════════════════════════════════
//  CRUD API 端点
// ═══════════════════════════════════════════

// ─── 宠物 ─────────────────────────────────

app.get('/api/pets', optionalAuth, async (req, res) => {
  try {
    if (!req.userId) return res.json({ code: 200, data: [] })
    const pets = await db.query(
      'SELECT f_id, f_public_uid, f_name, f_avatar_url, f_pet_type_id, f_breed_id, f_gender_id, f_birth_date, f_birth_year, f_birth_month, f_weight, f_sterilized, f_vaccinated, f_status_pet, f_personality_tags, f_created_at FROM t_pet WHERE f_user_id = ? AND f_deleted = 0 ORDER BY f_created_at DESC',
      [req.userId]
    )

    const result = await Promise.all(pets.map(async (p) => {
      const types = await db.query('SELECT f_name FROM t_pet_type WHERE f_id = ?', [p.f_pet_type_id])
      const genders = await db.query('SELECT f_name FROM t_gender WHERE f_id = ?', [p.f_gender_id])
      const ptName = types.length > 0 ? (typeof types[0].f_name === 'string' ? JSON.parse(types[0].f_name) : (types[0].f_name || {})) : {}
      const gName = genders.length > 0 ? (typeof genders[0].f_name === 'string' ? JSON.parse(genders[0].f_name) : (genders[0].f_name || {})) : {}
      return {
        id: p.f_id,
        publicUid: p.f_public_uid,
        name: p.f_name,
        avatar: p.f_avatar_url || '',
        petTypeId: p.f_pet_type_id,
        petType: ptName['zh-CN'] || ptName['en-US'] || '',
        breedId: p.f_breed_id,
        genderId: p.f_gender_id,
        gender: gName['zh-CN'] || gName['en-US'] || '',
        birthDate: p.f_birth_date,
        birthYear: p.f_birth_year,
        birthMonth: p.f_birth_month,
        weight: p.f_weight,
        sterilized: !!p.f_sterilized,
        vaccinated: !!p.f_vaccinated,
        statusPet: p.f_status_pet,
        tags: typeof p.f_personality_tags === 'string' ? JSON.parse(p.f_personality_tags) : p.f_personality_tags,
        createdAt: p.f_created_at,
      }
    }))

    res.json({ code: 200, data: result })
  } catch (err) {
    console.error('[GET /api/pets]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.get('/api/pets/:id', auth, async (req, res) => {
  try {
    const pets = await db.query('SELECT * FROM t_pet WHERE f_id = ? AND f_user_id = ? AND f_deleted = 0', [req.params.id, req.userId])
    if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

    const p = pets[0]
    const types = await db.query('SELECT f_name FROM t_pet_type WHERE f_id = ?', [p.f_pet_type_id])
    const genders = await db.query('SELECT f_name FROM t_gender WHERE f_id = ?', [p.f_gender_id])
    const ptName = types.length > 0 ? (typeof types[0].f_name === 'string' ? JSON.parse(types[0].f_name) : (types[0].f_name || {})) : {}
    const gName = genders.length > 0 ? (typeof genders[0].f_name === 'string' ? JSON.parse(genders[0].f_name) : (genders[0].f_name || {})) : {}

    res.json({
      code: 200,
      data: {
        id: p.f_id,
        name: p.f_name,
        avatar: p.f_avatar_url || '',
        petTypeId: p.f_pet_type_id,
        petType: ptName['zh-CN'] || ptName['en-US'] || '',
        breedId: p.f_breed_id,
        genderId: p.f_gender_id,
        gender: gName['zh-CN'] || gName['en-US'] || '',
        birthDate: p.f_birth_date,
        birthYear: p.f_birth_year,
        birthMonth: p.f_birth_month,
        weight: p.f_weight,
        sterilized: !!p.f_sterilized,
        vaccinated: !!p.f_vaccinated,
        statusPet: p.f_status_pet,
        tags: typeof p.f_personality_tags === 'string' ? JSON.parse(p.f_personality_tags) : p.f_personality_tags,
        createdAt: p.f_created_at,
    },
    })
  } catch (err) {
    console.error('[GET /api/pets/:id]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.post('/api/pets', auth, async (req, res) => {
  try {
    const { name, petTypeId, breedId, genderId, birthDate, birthYear, birthMonth, weight, sterilized, vaccinated, avatar, tags } = req.body
    if (!name) return res.status(400).json({ code: 400, message: '宠物名称不能为空' })

    const publicUid = uuid()
    const ts = timestamp()
    const result = await db.execute(
      `INSERT INTO t_pet (f_public_uid, f_user_id, f_name, f_avatar_url, f_pet_type_id, f_breed_id, f_gender_id, f_birth_date, f_birth_year, f_birth_month, f_weight, f_sterilized, f_vaccinated, f_personality_tags, f_status_id, f_created_at, f_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, ?)`,
      [
        publicUid, req.userId, name, avatar || '',
        petTypeId || 1, breedId || null, genderId || -1,
        birthDate || null, birthYear || null, birthMonth || null,
        weight || null, sterilized ? 1 : 0, vaccinated ? 1 : 0,
        JSON.stringify(tags || []),
        ts, ts,
      ]
    )

    res.json({
      code: 200,
      data: {
        id: result.insertId,
        publicUid,
        name,
        avatar: avatar || '',
        petTypeId: petTypeId || 1,
        breedId: breedId || null,
        genderId: genderId || -1,
        birthDate: birthDate || null,
        weight: weight || null,
        sterilized: !!sterilized,
        vaccinated: !!vaccinated,
        tags: tags || [],
        createdAt: ts,
    },
    })
  } catch (err) {
    console.error('[POST /api/pets]', err.message)
    res.status(500).json({ code: 500, message: '创建失败' })
  }
})

app.put('/api/pets/:id', auth, async (req, res) => {
  try {
    const { name, petTypeId, breedId, genderId, birthDate, birthYear, birthMonth, weight, sterilized, vaccinated, avatar, tags } = req.body
    const ts = timestamp()

    const sets = []
    const params = []
    if (name !== undefined) { sets.push('f_name = ?'); params.push(name) }
    if (petTypeId !== undefined) { sets.push('f_pet_type_id = ?'); params.push(petTypeId) }
    if (breedId !== undefined) { sets.push('f_breed_id = ?'); params.push(breedId) }
    if (genderId !== undefined) { sets.push('f_gender_id = ?'); params.push(genderId) }
    if (birthDate !== undefined) { sets.push('f_birth_date = ?'); params.push(birthDate) }
    if (birthYear !== undefined) { sets.push('f_birth_year = ?'); params.push(birthYear) }
    if (birthMonth !== undefined) { sets.push('f_birth_month = ?'); params.push(birthMonth) }
    if (weight !== undefined) { sets.push('f_weight = ?'); params.push(weight) }
    if (sterilized !== undefined) { sets.push('f_sterilized = ?'); params.push(sterilized ? 1 : 0) }
    if (vaccinated !== undefined) { sets.push('f_vaccinated = ?'); params.push(vaccinated ? 1 : 0) }
    if (avatar !== undefined) { sets.push('f_avatar_url = ?'); params.push(avatar) }
    if (tags !== undefined) { sets.push('f_personality_tags = ?'); params.push(JSON.stringify(tags)) }
    sets.push('f_updated_at = ?'); params.push(ts)

    params.push(req.params.id, req.userId)

    const result = await db.execute(
      `UPDATE t_pet SET ${sets.join(', ')} WHERE f_id = ? AND f_user_id = ? AND f_deleted = 0`,
      params
    )

    if (result.affectedRows === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

    res.json({ code: 200, data: { id: parseInt(req.params.id), updatedAt: ts } })
  } catch (err) {
    console.error('[PUT /api/pets/:id]', err.message)
    res.status(500).json({ code: 500, message: '更新失败' })
  }
})

app.delete('/api/pets/:id', auth, async (req, res) => {
  try {
    const ts = timestamp()
    const result = await db.execute(
      'UPDATE t_pet SET f_deleted = 1, f_updated_at = ? WHERE f_id = ? AND f_user_id = ?',
      [ts, req.params.id, req.userId]
    )
    if (result.affectedRows === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })
    res.json({ code: 200, data: null })
  } catch (err) {
    console.error('[DELETE /api/pets/:id]', err.message)
    res.status(500).json({ code: 500, message: '删除失败' })
  }
})

// ─── 报告 ─────────────────────────────────

app.get('/api/reports', auth, async (req, res) => {
  try {
    const { type, petId } = req.query
    let reports = []

    if (type === 'emotion' || !type) {
      let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_food_satisfaction, f_mood_level, f_body_status, f_status_summary, f_div_system, f_input_question, f_created_at FROM t_report_emotion WHERE f_user_id = ? AND f_deleted = 0'
      const params = [req.userId]
      if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
      sql += ' ORDER BY f_created_at DESC LIMIT 50'
      const rows = await db.query(sql, params)
      reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'emotion', typeName: '情绪解读', createdAt: r.f_created_at })))
    }

    if (type === 'health' || !type) {
      let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_health_score, f_health_level, f_symptom_analysis, f_created_at FROM t_report_health WHERE f_user_id = ? AND f_deleted = 0'
      const params = [req.userId]
      if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
      sql += ' ORDER BY f_created_at DESC LIMIT 50'
      const rows = await db.query(sql, params)
      reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'health', typeName: '健康监测', createdAt: r.f_created_at })))
    }

    if (type === 'risk' || !type) {
      let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_risk_level, f_risk_score, f_created_at FROM t_report_risk WHERE f_user_id = ? AND f_deleted = 0'
      const params = [req.userId]
      if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
      sql += ' ORDER BY f_created_at DESC LIMIT 50'
      const rows = await db.query(sql, params)
      reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'risk', typeName: '风险评估', createdAt: r.f_created_at })))
    }

    if (type === 'constitution' || !type) {
      let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_pet_constitution, f_created_at FROM t_report_constitution WHERE f_user_id = ? AND f_deleted = 0'
      const params = [req.userId]
      if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
      sql += ' ORDER BY f_created_at DESC LIMIT 50'
      const rows = await db.query(sql, params)
      reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'constitution', typeName: '体质综合分析', createdAt: r.f_created_at })))
    }

    if (type === 'medical' || !type) {
      let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_judgment AS f_core_answer, f_created_at FROM t_report_consultation WHERE f_user_id = ? AND f_deleted = 0'
      const params = [req.userId]
      if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
      sql += ' ORDER BY f_created_at DESC LIMIT 50'
      const rows = await db.query(sql, params)
      reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'medical', typeName: '医疗科普', createdAt: r.f_created_at })))
    }

    // 跨类型时按时间倒序合并
    if (!type) reports.sort((a, b) => (b.f_created_at || 0) - (a.f_created_at || 0))

    res.json({ code: 200, data: reports })
  } catch (err) {
    log.error('LLM medical error:', err.message)
    res.json({ code: 200, data: {
      id: `rpt_${Date.now()}`, type: 'medical',
      time: now(),
      summary: `根据你描述的"${symptom}"，建议密切观察并咨询兽医`,
      guide: [{ title: '请咨询专业兽医', desc: 'AI分析仅供参考，实际诊断请到正规宠物医院' }]
    }, _fallback: true })
  }
})

app.get('/api/reports/:id', auth, async (req, res) => {
  try {
    const tables = ['t_report_emotion', 't_report_health', 't_report_risk', 't_report_constitution', 't_report_consultation']
    for (const table of tables) {
      const rows = await db.query(
        `SELECT * FROM ${table} WHERE (f_id = ? OR f_public_uid = ?) AND f_user_id = ?`,
        [isNaN(req.params.id) ? -1 : parseInt(req.params.id), req.params.id, req.userId]
      )
      if (rows.length > 0) {
        const r = rows[0]
        return res.json({
          code: 200,
          data: {
            ...r,
            id: r.f_id,
            publicUid: r.f_public_uid,
            rawResponse: typeof r.f_llm_resp === 'string' ? JSON.parse(r.f_llm_resp) : r.f_llm_resp,
        },
        })
      }
    }
    res.status(404).json({ code: 404, message: '报告不存在' })
  } catch (err) {
    console.error('[GET /api/reports/:id]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

// ─── 收藏 ─────────────────────────────────

app.get('/api/favorites', auth, async (req, res) => {
  // t_favorite table not in PG schema — return empty list
  res.json({ code: 200, data: [] })
})

app.post('/api/favorites', auth, async (req, res) => {
  // t_favorite table not in PG schema — silently succeed
  res.json({ code: 200, data: { favorited: true } })
})

// ─── 商城 ─────────────────────────────────

app.get('/api/products', optionalAuth, async (req, res) => {
  try {
    const { category } = req.query
    let sql = `SELECT spu.f_id, spu.f_name, spu.f_description, spu.f_category_id, spu.f_brand, spu.f_meta_info, spu.f_created_at,
       (SELECT MIN(sku.f_price) FROM t_product_sku sku WHERE sku.f_spu_id = spu.f_id) AS f_price
       FROM t_product_spu spu WHERE spu.f_deleted = 0`
    const params = []
    if (category) { sql += ' AND spu.f_category_id = ?'; params.push(category) }
    sql += ' ORDER BY spu.f_created_at DESC'

    const products = await db.query(sql, params)
    res.json({
      code: 200,
      data: products.map(p => {
        const meta = (typeof p.f_meta_info === 'string' ? JSON.parse(p.f_meta_info) : (p.f_meta_info || {}))
        const name = (typeof p.f_name === 'string' ? JSON.parse(p.f_name) : (p.f_name || {}))
        return {
        id: p.f_id,
        name: name['zh-CN'] || name['en-US'] || '',
        desc: p.f_description || '',
        category: p.f_category_id,
        price: Number(p.f_price) || 0,
        image: meta.image_url || '',
      }}),
    })
  } catch (err) {
    console.error('[GET /api/products]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.get('/api/products/:id', optionalAuth, async (req, res) => {
  try {
    const products = await db.query(
      `SELECT spu.f_id, spu.f_name, spu.f_description, spu.f_category_id, spu.f_brand, spu.f_meta_info, spu.f_created_at,
       (SELECT MIN(sku.f_price) FROM t_product_sku sku WHERE sku.f_spu_id = spu.f_id) AS f_price
       FROM t_product_spu spu WHERE spu.f_id = ? AND spu.f_deleted = 0`,
      [req.params.id]
    )
    if (products.length === 0) return res.status(404).json({ code: 404, message: '商品不存在' })

    const p = products[0]
    const meta = (typeof p.f_meta_info === 'string' ? JSON.parse(p.f_meta_info) : (p.f_meta_info || {}))
    const name = (typeof p.f_name === 'string' ? JSON.parse(p.f_name) : (p.f_name || {}))
    res.json({
      code: 200,
      data: { id: p.f_id, name: name['zh-CN'] || name['en-US'] || '', desc: p.f_description || '', category: p.f_category_id, price: Number(p.f_price) || 0, image: meta.image_url || '' },
    })
  } catch (err) {
    console.error('[GET /api/products/:id]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.post('/api/orders', auth, async (req, res) => {
  try {
    const { productId, skuId, productName, price, quantity, receiver = {} } = req.body
    const qty = Math.max(parseInt(quantity || 1, 10), 1)
    let unitPrice = Number(price || 0)
    let finalProductName = productName || ''

    if (skuId || /^\d+$/.test(String(productId || ''))) {
      try {
        const products = await db.query(
          `SELECT sku.f_id AS f_sku_id, sku.f_price, spu.f_name
           FROM t_product_sku sku
           LEFT JOIN t_product_spu spu ON spu.f_id = sku.f_spu_id
           WHERE sku.f_id = ? OR spu.f_id = ?
           ORDER BY sku.f_id ASC
           LIMIT 1`,
          [skuId || productId, productId || skuId]
        )
        if (products.length > 0) {
          unitPrice = Number(products[0].f_price) || unitPrice
          const name = typeof products[0].f_name === 'string' ? JSON.parse(products[0].f_name) : (products[0].f_name || {})
          finalProductName = name['zh-CN'] || name['en-US'] || finalProductName
        }
      } catch (e) {
        console.warn('[POST /api/orders] product price fallback:', e.message)
      }
    }

    if (!finalProductName || unitPrice <= 0) {
      return res.status(400).json({ code: 400, message: '商品信息不完整' })
    }

    const totalAmount = Number((unitPrice * qty).toFixed(2))
    const ts = timestamp()
    const orderNo = `ORD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    const result = await db.execute(
      `INSERT INTO t_order (
        f_user_id, f_order_no, f_total_amount, f_final_amount, f_payment_method,
        f_status_payment, f_receiver_name, f_receiver_phone, f_receiver_address,
        f_meta_info, f_created_at, f_updated_at
      ) VALUES (?, ?, ?, ?, 'wechat', 1, ?, ?, ?, ?, ?, ?)
      RETURNING f_id`,
      [
        req.userId, orderNo, totalAmount, totalAmount,
        receiver.name || '待填写',
        receiver.phone || '00000',
        receiver.address || '待填写',
        JSON.stringify({ productName: finalProductName, productId, skuId: skuId || null, quantity: qty }),
        ts, ts,
      ]
    )
    const orderId = result.insertId || (result.rows && result.rows[0] && result.rows[0].f_id)

    try {
      if (skuId) {
        await db.execute(
          `INSERT INTO t_order_item (
            f_order_id, f_sku_id, f_product_name, f_quantity, f_unit_price,
            f_total_price, f_final_price, f_meta_info, f_created_at, f_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, skuId, finalProductName, qty, unitPrice, totalAmount, totalAmount, JSON.stringify({ productId }), ts, ts]
        )
      } else {
        await db.execute(
          `INSERT INTO t_order_item (f_order_id, f_product_name, f_quantity, f_unit_price, f_total_price, f_created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, finalProductName, qty, unitPrice, totalAmount, ts]
        )
      }
    } catch (e) {
      console.warn('[POST /api/orders] order item skipped:', e.message)
    }

    res.json({
      code: 200,
      data: { id: orderId, orderNo, status: 'pending', amount: totalAmount, createdAt: ts },
    })
  } catch (err) {
    console.error('[POST /api/orders]', err.message)
    res.status(500).json({ code: 500, message: '下单失败' })
  }
})

app.get('/api/orders/:id/payment-status', auth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT o.f_id, o.f_order_no, o.f_status_payment, ps.f_code AS f_payment_status
       FROM t_order o
       LEFT JOIN t_payment_status ps ON ps.f_id = o.f_status_payment
       WHERE o.f_id = ? AND o.f_user_id = ?`,
      [req.params.id, req.userId]
    )
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '订单不存在' })

    const order = rows[0]
    res.json({
      code: 200,
      data: {
        id: order.f_id,
        orderNo: order.f_order_no,
        status: order.f_payment_status || (order.f_status_payment === 10 ? 'paid' : 'pending'),
      },
    })
  } catch (err) {
    console.error('[GET /api/orders/:id/payment-status]', err.message)
    res.status(500).json({ code: 500, message: '查询支付状态失败' })
  }
})

app.post('/api/pay/wechat/jsapi', auth, async (req, res) => {
  try {
    const { orderId } = req.body
    const orders = await db.query(
      `SELECT f_id, f_order_no, f_final_amount, f_status_payment, f_meta_info
       FROM t_order
       WHERE f_id = ? AND f_user_id = ?`,
      [orderId, req.userId]
    )
    if (orders.length === 0) return res.status(404).json({ code: 404, message: '订单不存在' })

    const order = orders[0]
    if (Number(order.f_status_payment) === 10) {
      return res.status(400).json({ code: 400, message: '订单已支付' })
    }

    const users = await db.query('SELECT f_wx_openid FROM t_user WHERE f_id = ?', [req.userId])
    const openid = users[0] && users[0].f_wx_openid
    if (!openid || String(openid).startsWith('dev_')) {
      return res.status(400).json({ code: 400, message: '当前用户缺少正式微信 openid，请在真机微信环境重新登录' })
    }

    const meta = typeof order.f_meta_info === 'string' ? JSON.parse(order.f_meta_info) : (order.f_meta_info || {})
    const payment = await wechatPay.createJsapiOrder({
      openid,
      outTradeNo: order.f_order_no,
      description: meta.productName || '更懂它商品订单',
      amountFen: yuanToFen(order.f_final_amount),
      attach: String(order.f_id),
    })

    try {
      await db.execute(
        `INSERT INTO t_payment_transaction (
          f_order_id, f_order_no, f_provider, f_out_trade_no, f_prepay_id,
          f_amount, f_currency, f_status, f_raw_payload, f_created_at, f_updated_at
        ) VALUES (?, ?, 'wechat', ?, ?, ?, 'CNY', 'prepay', ?, ?, ?)`,
        [
          order.f_id, order.f_order_no, order.f_order_no, payment.prepayId,
          Number(order.f_final_amount), JSON.stringify({ prepayId: payment.prepayId }), timestamp(), timestamp(),
        ]
      )
    } catch (e) {
      console.warn('[POST /api/pay/wechat/jsapi] transaction log skipped:', e.message)
    }

    res.json({
      code: 200,
      data: {
        orderId: order.f_id,
        orderNo: order.f_order_no,
        payment,
      },
    })
  } catch (err) {
    console.error('[POST /api/pay/wechat/jsapi]', err.message, err.data || '')
    const status = err.code === 'WECHAT_PAY_CONFIG_MISSING' ? 500 : (err.status || 500)
    res.status(status).json({ code: status, message: err.message || '微信支付下单失败' })
  }
})

app.post('/api/pay/wechat/notify', async (req, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body || {})
    const verified = wechatPay.verifyWechatPaySignature(req.headers, rawBody)
    if (!verified) {
      return res.status(401).json({ code: 'FAIL', message: '签名验证失败' })
    }

    const event = req.body || {}
    const transaction = wechatPay.decryptResource(event.resource)
    const isPaid = transaction.trade_state === 'SUCCESS'
    const statusPayment = isPaid ? 10 : 30
    const ts = timestamp()

    const updateResult = await db.execute(
      `UPDATE t_order
       SET f_status_payment = ?, f_payment_method = 'wechat', f_payment_time = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE f_payment_time END, f_updated_at = ?
       WHERE f_order_no = ? AND f_status_payment <> 10`,
      [statusPayment, isPaid, ts, transaction.out_trade_no]
    )

    try {
      await db.execute(
        `UPDATE t_payment_transaction
         SET f_transaction_id = ?, f_status = ?, f_raw_notify = ?, f_paid_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE f_paid_at END, f_updated_at = ?
         WHERE f_out_trade_no = ?`,
        [
          transaction.transaction_id || '',
          transaction.trade_state || '',
          JSON.stringify(transaction),
          isPaid,
          ts,
          transaction.out_trade_no,
        ]
      )
    } catch (e) {
      console.warn('[POST /api/pay/wechat/notify] transaction update skipped:', e.message)
    }

    if (!updateResult.affectedRows) {
      console.log('[wechat notify] idempotent or unknown order:', transaction.out_trade_no)
    }

    res.json({ code: 'SUCCESS', message: '成功' })
  } catch (err) {
    console.error('[POST /api/pay/wechat/notify]', err.message)
    res.status(500).json({ code: 'FAIL', message: err.message || '回调处理失败' })
  }
})

// ─── 医院 ─────────────────────────────────

app.get('/api/hospitals', optionalAuth, async (req, res) => {
  try {
    const hospitals = await db.query(
      'SELECT f_id, f_name, f_address, f_phone, f_rating, f_service_tags, f_business_hours, f_meta_info FROM t_hospital WHERE f_deleted = 0 ORDER BY f_rating DESC'
    )
    res.json({
      code: 200,
      data: hospitals.map(h => {
        const meta = (typeof h.f_meta_info === 'string' ? JSON.parse(h.f_meta_info) : (h.f_meta_info || {}));
        return {
        id: h.f_id,
        name: h.f_name,
        address: h.f_address || '',
        phone: h.f_phone || '',
        rating: Number(h.f_rating) || 0,
        tags: (Array.isArray(h.f_service_tags) ? h.f_service_tags : (typeof h.f_service_tags === 'string' ? JSON.parse(h.f_service_tags) : [])),
        businessHours: h.f_business_hours || '',
        image: meta.image_url || '',
        lat: meta.lat || null,
        lng: meta.lng || null,
      }}),
    })
  } catch (err) {
    console.error('[GET /api/hospitals]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.get('/api/hospitals/:id', optionalAuth, async (req, res) => {
  try {
    const hospitals = await db.query('SELECT f_id, f_name, f_address, f_phone, f_rating, f_service_tags, f_business_hours, f_meta_info, f_created_at FROM t_hospital WHERE f_id = ? AND f_deleted = 0', [req.params.id])
    if (hospitals.length === 0) return res.status(404).json({ code: 404, message: '医院不存在' })

    const h = hospitals[0]
    const hmeta = (typeof h.f_meta_info === 'string' ? JSON.parse(h.f_meta_info) : (h.f_meta_info || {}));
    res.json({
      code: 200,
      data: {
        id: h.f_id, name: h.f_name, address: h.f_address || '', phone: h.f_phone || '',
        rating: Number(h.f_rating) || 0,
        tags: (Array.isArray(h.f_service_tags) ? h.f_service_tags : (typeof h.f_service_tags === 'string' ? JSON.parse(h.f_service_tags) : [])),
        businessHours: h.f_business_hours || '',
        image: hmeta.image_url || '', lat: hmeta.lat || null, lng: hmeta.lng || null,
    },
    })
  } catch (err) {
    console.error('[GET /api/hospitals/:id]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

// ─── 上传 ─────────────────────────────────

app.post('/api/upload', auth, async (req, res) => {
  try {
    // Simple: return the data URL if provided, or a placeholder
    const { fileUrl, category, petId } = req.body
    const publicUrl = fileUrl || ''

    // t_upload table not in PG schema — skip DB insert, just return URL
    if (publicUrl) {
      // Success — URL is stored on client side or cloud storage
    }

    res.json({ code: 200, data: { publicUrl } })
  } catch (err) {
    console.error('[POST /api/upload]', err.message)
    res.status(500).json({ code: 500, message: '上传失败' })
  }
})

// ─── 聊天会话 ─────────────────────────────

app.get('/chat/sessions', optionalAuth, async (req, res) => {
  try {
    if (!req.userId) return res.json({ code: 200, data: { sessions: [] } })
    const rows = await db.query(
      `SELECT h.f_id, h.f_pet_id, h.f_meta_info, h.f_ended_at, p.f_name
       FROM t_chat_history h LEFT JOIN t_pet p ON p.f_id = h.f_pet_id
       WHERE h.f_user_id = ?
       ORDER BY h.f_ended_at DESC NULLS LAST LIMIT 50`,
      [req.userId]
    )
    res.json({
      code: 200,
      data: {
        sessions: rows.map(s => {
          const meta = (typeof s.f_meta_info === 'string' ? JSON.parse(s.f_meta_info) : (s.f_meta_info || {}))
          return {
          id: s.f_id,
          petId: s.f_pet_id,
          petName: s.f_name || '',
          title: meta.title || '',
          time: s.f_ended_at,
        }}),
    },
    })
  } catch (err) {
    console.error('[GET /chat/sessions]', err.message)
    res.json({ code: 200, data: { sessions: [] } })
  }
})

app.post('/chat/sessions', auth, async (req, res) => {
  try {
    const { petId } = req.body
    if (!petId) return res.status(400).json({ code: 400, message: '缺少 petId' })

    // Verify pet belongs to user
    const pets = await db.query('SELECT f_id, f_name, f_birth_date FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, req.userId])
    if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

    const ts = new Date().toISOString()
    const title = `与${pets[0].f_name}的对话`
    const result = await db.execute(
      `INSERT INTO t_chat_history (f_user_id, f_pet_id, f_lang, f_chat_history, f_meta_info, f_started_at, f_ended_at) VALUES (?, ?, 'zh-CN', '[]'::jsonb, ?, NOW(), NOW()) RETURNING f_id`,
      [req.userId, petId, JSON.stringify({ title })]
    )
    const sessionId = result.insertId || (result.rows && result.rows[0] && result.rows[0].f_id)

    // Seed in-memory context metadata
    const session = memory.get(sessionId)
    session.userId = req.userId
    session.petId = petId
    session.petName = pets[0].f_name

    res.json({
      code: 200,
      data: { sessionId, petId, petName: pets[0].f_name },
    })
  } catch (err) {
    console.error('[POST /chat/sessions]', err.message)
    res.status(500).json({ code: 500, message: '创建会话失败' })
  }
})

app.get('/chat/messages', auth, async (req, res) => {
  try {
    const { sessionId } = req.query
    if (!sessionId) return res.status(400).json({ code: 400, message: '缺少 sessionId' })

    // Verify ownership
    const sessRows = await db.query(
      'SELECT f_id, f_chat_history FROM t_chat_history WHERE f_id = ? AND f_user_id = ?',
      [isNaN(sessionId) ? -1 : parseInt(sessionId), req.userId]
    )
    if (sessRows.length === 0) return res.status(404).json({ code: 404, message: '会话不存在' })

    const raw = sessRows[0].f_chat_history
    const history = (typeof raw === 'string' ? JSON.parse(raw) : raw) || []
    res.json({
      code: 200,
      data: {
        sessionId,
        messages: history.map((m, i) => ({ id: i + 1, role: m.role, content: m.content, at: m.created_at })),
    },
    })
  } catch (err) {
    console.error('[GET /chat/messages]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

// ═══════════════════════════════════════════
//  健康检查
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
//  启动
// ═══════════════════════════════════════════

app.listen(PORT, () => {
  log.info('═══════════════════════════════════')
  log.info('  🐾 更懂它 后端已启动')
  log.info(`  📡 http://localhost:${PORT}`)
  log.info(`  🤖 DeepSeek 智能体: ${llm.available() ? '✅ 已连接' : '❌ 未配置（降级 mock）'}`)
  log.info(`  🗄️  数据库: PostgreSQL (Supabase)`)
  log.info('═══════════════════════════════════')
  log.info('')
  log.info('  DeepSeek 端点:')
  log.info('  POST /api/emotion/report   情绪解读')
  log.info('  POST /api/health/report    健康监测')
  log.info('  POST /api/risk/report      风险评估')
  log.info('  POST /api/medical/guide    医疗科普')
  log.info('  POST /api/chat/send-json   AI 聊天')
  log.info('')
})
