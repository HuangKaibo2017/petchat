require('dotenv').config({ path: '../.env.local' })

const express = require('express')
const app = express()
const PORT = process.env.SERVER_PORT || 8001

app.use(express.json({ limit: '10mb' }))

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

// ═══════════════════════════════════════════
//  内置智能体引擎
// ═══════════════════════════════════════════

const llm     = require('./src/core/llm')
const memory  = require('./src/core/memory')
const router  = require('./src/core/router')
const agents  = require('./src/agents/registry')

// ═══════════════════════════════════════════
//  MySQL 数据库
// ═══════════════════════════════════════════

const db = require('./src/db/mysql')

// 启动时加载健康检查工具
require('./src/tools/health')

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
      `INSERT INTO t_report_emotion (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_food_satisfaction, f_mood_level, f_body_status, f_status_summary, f_owner_view, f_pet_message, f_pet_wish, f_product_recommend, f_raw_response, f_status_id, f_created_at)
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
      `INSERT INTO t_report_health (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_health_score, f_health_level, f_symptom_analysis, f_diet_advice, f_exercise_advice, f_care_tips, f_vet_advice, f_raw_response, f_status_id, f_created_at)
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
      `INSERT INTO t_report_risk (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_risk_level, f_risk_score, f_risk_factors, f_prevention, f_emergency_guide, f_raw_response, f_status_id, f_created_at)
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
      `INSERT INTO t_report_constitution (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_owner_birthday, f_core_answer, f_pet_constitution, f_owner_match, f_season_advice, f_diet_advice, f_raw_response, f_status_id, f_created_at)
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
        `INSERT INTO t_report_medical (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_symptom, f_duration, f_core_answer, f_symptom_explain, f_home_care, f_warning_sign, f_hospital_check, f_raw_response, f_status_id, f_created_at)
         VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
        [
          reportId, req.userId, petId || null,
          symptom || JSON.stringify(req.body), symptom || '', duration || '',
          report.judgment || '',
          report.symptomExplain || '',
          report.homeCare ? JSON.stringify(report.homeCare) : null,
          report.warningSign ? JSON.stringify(report.warningSign) : null,
          report.hospitalCheck ? JSON.stringify(report.hospitalCheck) : null,
          JSON.stringify(report),
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
      'SELECT f_role, f_content, f_created_at FROM t_chat_message WHERE f_session_id = ? ORDER BY f_id ASC LIMIT 40',
      [sessionId]
    )
    for (const r of rows) {
      // map stored 'pet' role back to 'assistant' for LLM context
      session.messages.push({ role: r.f_role === 'pet' ? 'assistant' : r.f_role, content: r.f_content, at: r.f_created_at })
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
      'SELECT s.f_id, s.f_pet_id, p.f_name, p.f_birth_date FROM t_chat_session s LEFT JOIN t_pet p ON p.f_id = s.f_pet_id WHERE s.f_id = ? AND s.f_user_id = ?',
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

    // Persist both turns
    const ts = timestamp()
    await db.execute(
      'INSERT INTO t_chat_message (f_session_id, f_role, f_content, f_created_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [sessionId, 'user', message, ts, sessionId, 'pet', reply, ts]
    )
    await db.execute('UPDATE t_chat_session SET f_updated_at = ? WHERE f_id = ?', [ts, sessionId])

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
      let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_symptom, f_created_at FROM t_report_medical WHERE f_user_id = ? AND f_deleted = 0'
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
    console.error('[GET /api/reports]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.get('/api/reports/:id', auth, async (req, res) => {
  try {
    const tables = ['t_report_emotion', 't_report_health', 't_report_risk', 't_report_constitution', 't_report_medical']
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
            rawResponse: typeof r.f_raw_response === 'string' ? JSON.parse(r.f_raw_response) : r.f_raw_response,
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
  try {
    const favs = await db.query(
      'SELECT f_target_id, f_target_type, f_created_at FROM t_favorite WHERE f_user_id = ? ORDER BY f_created_at DESC',
      [req.userId]
    )
    res.json({
      code: 200,
      data: favs.map(f => ({ id: f.f_target_id, type: f.f_target_type, time: f.f_created_at })),
    })
  } catch (err) {
    console.error('[GET /api/favorites]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.post('/api/favorites', auth, async (req, res) => {
  try {
    const { reportId, type } = req.body
    const targetId = reportId || req.body.id
    const targetType = type || req.body.type || 'report'

    // Check existing
    const existing = await db.query(
      'SELECT f_id FROM t_favorite WHERE f_user_id = ? AND f_target_id = ? AND f_target_type = ?',
      [req.userId, targetId, targetType]
    )

    if (existing.length > 0) {
      await db.execute('DELETE FROM t_favorite WHERE f_id = ?', [existing[0].f_id])
      return res.json({ code: 200, data: { favorited: false } })
    }

    await db.execute(
      'INSERT INTO t_favorite (f_user_id, f_target_id, f_target_type, f_created_at) VALUES (?, ?, ?, ?)',
      [req.userId, targetId, targetType, timestamp()]
    )
    res.json({ code: 200, data: { favorited: true } })
  } catch (err) {
    console.error('[POST /api/favorites]', err.message)
    res.status(500).json({ code: 500, message: '操作失败' })
  }
})

// ─── 商城 ─────────────────────────────────

app.get('/api/products', optionalAuth, async (req, res) => {
  try {
    const { category } = req.query
    let sql = 'SELECT f_id, f_name, f_desc, f_category, f_price, f_image_url FROM t_product WHERE f_deleted = 0 AND f_status_id = 10'
    const params = []
    if (category) { sql += ' AND f_category = ?'; params.push(category) }
    sql += ' ORDER BY f_created_at DESC'

    const products = await db.query(sql, params)
    res.json({
      code: 200,
      data: products.map(p => ({
        id: p.f_id,
        name: p.f_name,
        desc: p.f_desc,
        category: p.f_category,
        price: p.f_price,
        image: p.f_image_url || '',
      })),
    })
  } catch (err) {
    console.error('[GET /api/products]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.get('/api/products/:id', optionalAuth, async (req, res) => {
  try {
    const products = await db.query('SELECT * FROM t_product WHERE f_id = ? AND f_deleted = 0', [req.params.id])
    if (products.length === 0) return res.status(404).json({ code: 404, message: '商品不存在' })

    const p = products[0]
    res.json({
      code: 200,
      data: { id: p.f_id, name: p.f_name, desc: p.f_desc, category: p.f_category, price: p.f_price, image: p.f_image_url || '' },
    })
  } catch (err) {
    console.error('[GET /api/products/:id]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.post('/api/orders', auth, async (req, res) => {
  try {
    const { productId, productName, price, quantity } = req.body
    const ts = timestamp()
    const result = await db.execute(
      'INSERT INTO t_order (f_user_id, f_product_id, f_product_name, f_price, f_quantity, f_status, f_created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.userId, productId || null, productName || '', price || 0, quantity || 1, 'paid', ts]
    )
    res.json({
      code: 200,
      data: { id: result.insertId, status: 'paid', createdAt: ts },
    })
  } catch (err) {
    console.error('[POST /api/orders]', err.message)
    res.status(500).json({ code: 500, message: '下单失败' })
  }
})

// ─── 医院 ─────────────────────────────────

app.get('/api/hospitals', optionalAuth, async (req, res) => {
  try {
    const hospitals = await db.query(
      'SELECT f_id, f_name, f_address, f_phone, f_rating, f_tags, f_business_hours, f_image_url, f_lat, f_lng FROM t_hospital WHERE f_deleted = 0 ORDER BY f_rating DESC'
    )
    res.json({
      code: 200,
      data: hospitals.map(h => ({
        id: h.f_id,
        name: h.f_name,
        address: h.f_address || '',
        phone: h.f_phone || '',
        rating: h.f_rating || 0,
        tags: (Array.isArray(h.f_tags) ? h.f_tags : (typeof h.f_tags === 'string' ? JSON.parse(h.f_tags) : [])),
        businessHours: h.f_business_hours || '',
        image: h.f_image_url || '',
        lat: h.f_lat,
        lng: h.f_lng,
      })),
    })
  } catch (err) {
    console.error('[GET /api/hospitals]', err.message)
    res.status(500).json({ code: 500, message: '查询失败' })
  }
})

app.get('/api/hospitals/:id', optionalAuth, async (req, res) => {
  try {
    const hospitals = await db.query('SELECT * FROM t_hospital WHERE f_id = ? AND f_deleted = 0', [req.params.id])
    if (hospitals.length === 0) return res.status(404).json({ code: 404, message: '医院不存在' })

    const h = hospitals[0]
    res.json({
      code: 200,
      data: {
        id: h.f_id, name: h.f_name, address: h.f_address || '', phone: h.f_phone || '',
        rating: h.f_rating || 0,
        tags: (Array.isArray(h.f_tags) ? h.f_tags : (typeof h.f_tags === 'string' ? JSON.parse(h.f_tags) : [])),
        businessHours: h.f_business_hours || '',
        image: h.f_image_url || '', lat: h.f_lat, lng: h.f_lng,
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

    if (publicUrl) {
      await db.execute(
        'INSERT INTO t_upload (f_user_id, f_pet_id, f_category, f_file_url, f_created_at) VALUES (?, ?, ?, ?, ?)',
        [req.userId, petId || null, category || 'general', publicUrl, timestamp()]
      )
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
      `SELECT s.f_id, s.f_pet_id, s.f_title, s.f_updated_at, p.f_name
       FROM t_chat_session s LEFT JOIN t_pet p ON p.f_id = s.f_pet_id
       WHERE s.f_user_id = ? AND s.f_status_id = 10
       ORDER BY s.f_updated_at DESC LIMIT 50`,
      [req.userId]
    )
    res.json({
      code: 200,
      data: {
        sessions: rows.map(s => ({
          id: s.f_id,
          petId: s.f_pet_id,
          petName: s.f_name || '',
          title: s.f_title || '',
          time: s.f_updated_at,
        })),
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

    const ts = timestamp()
    const result = await db.execute(
      'INSERT INTO t_chat_session (f_user_id, f_pet_id, f_title, f_status_id, f_created_at, f_updated_at) VALUES (?, ?, ?, 10, ?, ?)',
      [req.userId, petId, `与${pets[0].f_name}的对话`, ts, ts]
    )
    const sessionId = result.insertId

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
      'SELECT f_id FROM t_chat_session WHERE f_id = ? AND f_user_id = ?',
      [isNaN(sessionId) ? -1 : parseInt(sessionId), req.userId]
    )
    if (sessRows.length === 0) return res.status(404).json({ code: 404, message: '会话不存在' })

    const rows = await db.query(
      'SELECT f_id, f_role, f_content, f_created_at FROM t_chat_message WHERE f_session_id = ? ORDER BY f_id ASC',
      [sessionId]
    )
    res.json({
      code: 200,
      data: {
        sessionId,
        messages: rows.map(m => ({ id: m.f_id, role: m.f_role, content: m.f_content, at: m.f_created_at })),
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

app.listen(PORT, async () => {
  console.log('═══════════════════════════════════')
  console.log('  🐾 更懂它 后端已启动')
  console.log(`  📡 http://localhost:${PORT}`)

  // Check DB connection
  const dbOk = await db.ping()
  console.log(`  🗄️  MySQL: ${dbOk ? '✅ 已连接' : '⚠️  未连接（请确认 MySQL 已启动且已导入 schema）'}`)

  // 异步检查 LLM 连通性
  llm.ping().then(ok => {
    console.log(`  🤖 智能体引擎: ${ok ? '✅ LLM 已连接' : '⚠️  LLM_API_KEY 未配置（降级 mock）'}`)
  })

  console.log(`  🧠 会话数: ${memory.count()}`)
  console.log('═══════════════════════════════════')
  console.log('')
  console.log('  智能体端点:')
  console.log('  POST /emotion-report      情绪解读')
  console.log('  POST /health-report       健康监测')
  console.log('  POST /risk-report         风险评估')
  console.log('  POST /constitution/report 体质综合分析')
  console.log('  POST /newpet/guide        新宠购买建议')
  console.log('  POST /medical/guide       医疗科普')
  console.log('  POST /medical/followup    追问对话')
  console.log('  POST /chat/send           流式聊天')
  console.log('  POST /chat/send-json      非流式聊天')
  console.log('')
  console.log('  CRUD 端点:')
  console.log('  GET    /api/pets          宠物列表')
  console.log('  POST   /api/pets          添加宠物')
  console.log('  GET    /api/reports       报告历史')
  console.log('  GET    /api/products      商品列表')
  console.log('  GET    /api/hospitals     医院列表')
  console.log('  POST   /api/favorites     收藏切换')
  console.log('  POST   /wechat-auth       微信登录')
  console.log('')
})
