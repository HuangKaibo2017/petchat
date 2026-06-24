require('dotenv').config({ path: '../../.env.local' })

const { createLogger } = require('./utils/logger')
const log = createLogger('app')

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

// ═══════════════════════════════════════════
//  Coze 智能体客户端
// ═══════════════════════════════════════════

const COZE_API_KEY = process.env.COZE_API_KEY
const COZE_AGENT_URL = process.env.COZE_AGENT_URL || 'https://7fwvpgbyhs.coze.site/stream_run'

const COZE_PROJECTS = {
  mood:        process.env.COZE_MOOD_PROJECT_ID,
  health:      process.env.COZE_HEALTH_CHECK_PROJECT_ID,
  constitution:process.env.COZE_CONSTITUTION_PROJECT_ID,
  personality: process.env.COZE_PERSONALITY_PROJECT_ID,
  chat:        process.env.COZE_CHAT_PROJECT_ID,
  consultation:process.env.COZE_CONSULTATION_PROJECT_ID,
}

let cozeAvailable = !!(COZE_API_KEY && COZE_AGENT_URL)

// Accept-Language: zh-CN → 中文
const LANG = 'zh-CN'

/**
 * Coze 非流式调用 — 等待完整结果返回
 */
async function cozeChat(projectId, userId, parameters) {
  const res = await fetch(COZE_AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${COZE_API_KEY}`,
      'Accept-Language': LANG,
    },
    body: JSON.stringify({
      project_id: projectId,
      user_id: String(userId),
      parameters,
      stream: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Coze API ${res.status}: ${text}`)
  }

  const raw = await res.text()

  // Coze 有时返回 SSE 格式即使 stream:false，先尝试 JSON
  try { return JSON.parse(raw) } catch {}

  // 解析 Coze SSE 格式
  // 格式: event: message\ndata: {"type":"answer","content":{"answer":"文本"}}
  let fullText = ''
  let currentEvent = ''
  const lines = raw.split('\n')
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim()
      continue
    }
    if (!line.startsWith('data: ')) continue
    const dataStr = line.slice(6).trim()
    if (!dataStr || dataStr === '[DONE]') continue
    try {
      const parsed = JSON.parse(dataStr)
      // Coze 格式: content.answer 字段
      if (parsed.type === 'answer' && parsed.content?.answer) {
        fullText += parsed.content.answer
      }
      // OpenAI 兼容格式
      else if (parsed.choices?.[0]?.delta?.content) {
        fullText += parsed.choices[0].delta.content
      }
      // 兜底
      else if (typeof parsed.content === 'string') {
        fullText += parsed.content
      }
    } catch {}
  }

  // 如果提取到了文字，包装成兼容格式返回
  if (fullText) return { content: fullText, data: { content: fullText } }

  // 最后尝试把整个 raw 当 JSON
  try { return JSON.parse(raw) } catch {}
  return raw
}

/**
 * Coze 流式调用 — 累积 token 并收集最终输出
 */
async function cozeChatStream(projectId, userId, parameters, onToken) {
  const res = await fetch(COZE_AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${COZE_API_KEY}`,
      'Accept-Language': LANG,
    },
    body: JSON.stringify({
      project_id: projectId,
      user_id: String(userId),
      parameters,
      stream: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Coze API ${res.status}: ${text}`)
  }

  let fullContent = ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const token =
          parsed.data?.content ??
          parsed.choices?.[0]?.delta?.content ??
          parsed.content ??
          ''
        if (token && typeof token === 'string') {
          fullContent += token
          if (onToken) onToken(token)
        }
      } catch { /* skip parse */ }
    }
  }

  return fullContent
}

/** 安全解析 Coze 返回的 JSON（去掉 markdown fence） */
function parseAIJson(raw) {
  if (typeof raw === 'object') return raw
  let cleaned = String(raw).trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  return JSON.parse(cleaned.trim())
}

// ═══════════════════════════════════════════
//  Mock 数据（无 Coze 时降级使用）
// ═══════════════════════════════════════════

const db = {
  pets: [
    { id: 'pet_001', name: '小橘', breed: '中华田园猫', age: '2岁', gender: 'male', neutered: true, history: '曾患轻微猫癣（已愈）', vaccine: '三联+狂犬已打', tags: ['平和质', '气虚倾向'], avatar: '', createdAt: '2025-03-15' },
    { id: 'pet_002', name: '旺财', breed: '柯基', age: '1岁半', gender: 'female', neutered: false, history: '无重大病史', vaccine: '卫佳捌+狂犬已打', tags: ['平和质'], avatar: '', createdAt: '2025-08-20' }
  ],
  reports: [],
  orders: [],
  favorites: [],
  chatSessions: [],
  products: [
    { id: 'nfc001', name: '灵犀NFC项圈', desc: '扫码即达·宠物智能身份', price: '299', image: '', category: 'nfc', stock: 100 },
    { id: 'bead001', name: '合香安神香珠', desc: '舒缓情绪·天然合香', price: '168', image: '', category: 'beads', stock: 200 },
    { id: 'bead002', name: '象数水晶·健康款', desc: '能量调理·平衡体质', price: '258', image: '', category: 'beads', stock: 150 },
    { id: 'tag001', name: '智能防丢牌', desc: 'GPS定位·防走失', price: '199', image: '', category: 'nfc', stock: 80 },
    { id: 'food001', name: '冻干生骨肉·鸡肉味', desc: '高蛋白·无添加', price: '89', image: '', category: 'food', stock: 500 },
    { id: 'ins001', name: '宠物医疗险·基础版', desc: '全年保障·直付理赔', price: '299', image: '', category: 'insurance', stock: 999 }
  ],
  hospitals: [
    { id: 1, name: '瑞鹏宠物医院(南山店)', rating: '4.8', distance: '1.2km', tags: ['24小时', '直付', '中医'], address: '南山区科技园南路100号', phone: '0755-88888888' },
    { id: 2, name: '芭比堂动物医院', rating: '4.7', distance: '2.5km', tags: ['康复', '牙科'], address: '福田区莲花路200号', phone: '0755-88888889' },
    { id: 3, name: '爱诺动物医院', rating: '4.6', distance: '3.1km', tags: ['急诊', '手术'], address: '宝安区新安路300号', phone: '0755-88888890' },
    { id: 4, name: '美联众合动物医院', rating: '4.9', distance: '4.0km', tags: ['综合', 'CT', 'MRI'], address: '罗湖区深南东路400号', phone: '0755-88888891' }
  ]
}

// ═══════════════════════════════════════════
//  Auth 中间件 — JWT 校验（开发模式降级为 demo token）
// ═══════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'local_dev_jwt_secret_change_me'
const NODE_ENV = process.env.NODE_ENV || 'development'

const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' })

  // 开发模式：demo token 快速放行
  if (NODE_ENV === 'development' && token === 'demo_token_local') {
    req.userId = 'user_001'
    return next()
  }

  // 生产模式：验证 JWT
  try {
    const crypto = require('crypto')
    const [headerB64, payloadB64, signature] = token.split('.')
    if (!headerB64 || !payloadB64 || !signature) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: '无效的 token 格式' })
    }

    // HMAC-SHA256 签名校验
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url')

    if (signature !== expectedSig) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'token 校验失败' })
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'token 已过期' })
    }

    req.userId = payload.sub || payload.userId || 'user_001'
    next()
  } catch (err) {
    console.error('[Auth] JWT 校验失败:', err.message)
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'token 无效' })
  }
}

// ═══════════════════════════════════════════
//  宠物档案
// ═══════════════════════════════════════════

app.get('/api/pets', auth, (req, res) => {
  res.json({ code: 200, data: db.pets })
})

app.post('/api/pets', auth, (req, res) => {
  const pet = { ...req.body, id: `pet_${Date.now()}`, tags: ['平和质'], createdAt: now() }
  db.pets.push(pet)
  res.json({ code: 200, data: pet })
})

app.put('/api/pets/:id', auth, (req, res) => {
  const idx = db.pets.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: '宠物不存在' })
  db.pets[idx] = { ...db.pets[idx], ...req.body }
  res.json({ code: 200, data: db.pets[idx] })
})

app.delete('/api/pets/:id', auth, (req, res) => {
  const idx = db.pets.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: '宠物不存在' })
  db.pets = db.pets.filter(p => p.id !== req.params.id)
  res.json({ code: 200 })
})

// ═══════════════════════════════════════════
//  情绪解读报告 (Coze 智能体)
// ═══════════════════════════════════════════

app.post('/api/emotion/report', auth, async (req, res) => {
  const { petId, question, divSystem, numbers, imageUrl, reportType } = req.body
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]

  if (!cozeAvailable || !COZE_PROJECTS.mood) {
    return res.json({ code: 200, data: mockEmotionReport(pet, question, divSystem, reportType) })
  }

  try {
    const projectId = reportType === 'personality' ? COZE_PROJECTS.personality : COZE_PROJECTS.mood
    const divNames = { liuyao: '六爻起卦', meihua: '梅花易数', daliuren: '大六壬', tarot: '塔罗' }

    const raw = await cozeChat(projectId, 'user_001', {
      petName: pet.name,
      petType: pet.breed,
      petGender: pet.gender,
      question,
      divSystem: divNames[divSystem] || divSystem,
      divNumbers: (numbers || []).join(','),
      imageUrl: imageUrl || '',
      reportType: reportType || 'emotion',
    })

    let reportJson
    const rawContent = (raw && raw.content) ? raw.content : raw
    try { reportJson = parseAIJson(rawContent) }
    catch {
      // Coze 返回非 JSON 文本时，直接用作文本报告
      const textContent = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
      reportJson = {
        coreAnswer: textContent,
        coreBasis: '',
        foodSatisfaction: '---',
        moodLevel: '---',
        bodyStatus: '',
        statusSummary: textContent,
        ownerView: '',
        petMessage: '',
        petWish: '',
        carePlan: [],
        products: [],
      }
    }

    const moodStars = (reportJson.moodLevel?.match(/★/g) || []).length
    let emotionState = '平静放松'
    if (moodStars >= 4) emotionState = '开心愉悦'
    else if (moodStars >= 3) emotionState = '平静放松'
    else if (moodStars >= 2) emotionState = '低落不安'
    else emotionState = '焦虑紧张'

    const report = {
      id: `rpt_${Date.now()}`,
      type: 'emotion', typeName: reportType === 'personality' ? '性格分析' : '情绪解读',
      petName: pet.name, petAvatar: pet.avatar, petId: pet.id,
      question, divSystem,
      time: now(), createdAt: now(),
      ...reportJson,
      emotionScore: Math.min(moodStars * 20, 100),
      emotionState,
      emotionTags: [reportJson.foodSatisfaction, reportJson.moodLevel, reportJson.bodyStatus].filter(Boolean),
    }
    db.reports.push(report)
    res.json({ code: 200, data: report })
  } catch (err) {
    console.error('Coze emotion report error:', err.message)
    const report = mockEmotionReport(pet, question, divSystem, reportType)
    db.reports.push(report)
    res.json({ code: 200, data: report, _fallback: true })
  }
})

function mockEmotionReport(pet, question, divSystem, reportType) {
  const replies = [
    { coreAnswer: '今天状态不错，心情比较放松，对早餐挺满意的。', coreBasis: '卦象显示离火生坤土，心气通于脾胃' },
    { coreAnswer: '有点小情绪，可能是天气变化影响，不太想动。', coreBasis: '坎水克离火，情绪受抑' },
    { coreAnswer: '精力旺盛，想出去玩，对食物兴趣很大。', coreBasis: '震卦当令，木气生发，活力释放' }
  ]
  const r = replies[Math.floor(Math.random() * replies.length)]
  return {
    id: `rpt_${Date.now()}`, type: 'emotion', typeName: reportType === 'personality' ? '性格分析' : '情绪解读',
    petName: pet.name, petAvatar: pet.avatar, petId: pet.id,
    question, divSystem,
    time: now(), createdAt: now(),
    ...r,
    foodSatisfaction: '★★★☆☆', moodLevel: '★★★★☆', bodyStatus: '无不适',
    statusSummary: '今天情绪平稳偏愉悦，对食物接受度尚可。',
    ownerView: '我感觉你今天有点累，压力好大。摸我的时候手比平时重。别太辛苦啦，主人超厉害的。',
    petMessage: '妈妈，我想吃带汤的罐头～还有窗户开小点行吗，风有点凉。但我还是最爱你的。',
    petWish: '今晚能不能早点回家陪我玩十分钟逗猫棒？',
    carePlan: [
      { title: '中兽医养护', desc: '适量温补脾胃，可煮少量鸡胸肉丝搭配南瓜泥。避免生冷食物。' },
      { title: '香疗建议', desc: '使用合香安神香珠放置于常活动区域，檀香乳香配比舒缓情绪。' },
      { title: '游戏互动', desc: '每天15-20分钟温和逗猫棒游戏，避免剧烈跑跳。' }
    ],
    products: [
      { id: 'bead001', name: '合香安神香珠', price: '168', image: '' },
      { id: 'nfc001', name: '灵犀NFC项圈', price: '299', image: '' }
    ],
    riskLevel: 'low', riskText: '安全'
  }
}

// ═══════════════════════════════════════════
//  健康监测报告 (Coze)
// ═══════════════════════════════════════════

app.post('/api/health/report', auth, async (req, res) => {
  const { petId, symptom, duration, abnormal, numbers, imageUrl } = req.body
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]

  if (!cozeAvailable || !COZE_PROJECTS.health) {
    return res.json({ code: 200, data: mockHealthReport(pet, symptom, duration) })
  }

  try {
    const raw = await cozeChat(COZE_PROJECTS.health, 'user_001', {
      petName: pet.name, petType: pet.breed,
      petAge: pet.age, petGender: pet.gender,
      symptom, duration, abnormal,
      numbers: (numbers || []).join(','),
      imageUrl: imageUrl || '',
    })

    let reportJson
    const rawContent = (raw && raw.content) ? raw.content : raw
    try { reportJson = parseAIJson(rawContent) }
    catch {
      const textContent = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
      reportJson = {
        healthScore: 0, healthLevel: '未知',
        constitutionLabel: '', summary: textContent,
        currentSymptoms: '', warning: [],
        carePlan: [], recommendProducts: [], followUp: '',
      }
    }

    const report = {
      id: `rpt_${Date.now()}`, type: 'health', typeName: '健康监测',
      petName: pet.name, petId: pet.id,
      time: now(), createdAt: now(),
      ...reportJson,
    }
    db.reports.push(report)
    res.json({ code: 200, data: report })
  } catch (err) {
    console.error('Coze health report error:', err.message)
    const report = mockHealthReport(pet, symptom, duration)
    db.reports.push(report)
    res.json({ code: 200, data: report, _fallback: true })
  }
})

function mockHealthReport(pet, symptom, duration) {
  return {
    id: `rpt_${Date.now()}`, type: 'health', typeName: '健康监测',
    petName: pet.name, petId: pet.id,
    time: now(), createdAt: now(),
    healthScore: 78, healthLevel: '亚健康',
    constitutionLabel: pet.tags[0] || '平和质',
    summary: `根据你描述的"${symptom}"持续${duration}，初步判断为消化系统轻度不适`,
    currentSymptoms: symptom,
    warning: ['注意观察饮食和排便情况，若持续48小时请就医'],
    carePlan: [
      { title: '饮食调整', desc: '暂停零食，只喂易消化的主食。少量多餐。' },
      { title: '环境管理', desc: '确保饮水充足，保持环境安静。' },
      { title: '观察要点', desc: '记录排便次数和性状，如有异常及时就医。' }
    ],
    recommendProducts: [
      { name: '冻干生骨肉·鸡肉味', price: '89', reason: '易消化高蛋白' }
    ],
    followUp: '3天后如无好转建议就医'
  }
}

// ═══════════════════════════════════════════
//  人宠风险评估 (Coze)
// ═══════════════════════════════════════════

app.post('/api/risk/report', auth, async (req, res) => {
  const { petId, reportId, ownerBirthday, tongueImage } = req.body
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]

  if (!cozeAvailable || !COZE_PROJECTS.constitution) {
    return res.json({ code: 200, data: mockRiskReport(pet) })
  }

  try {
    const raw = await cozeChat(COZE_PROJECTS.constitution, 'user_001', {
      petName: pet.name, petBreed: pet.breed,
      petBirthDate: pet.createdAt || '',
      petWeight: '',
      ownerBirthday,
      tongueImage: tongueImage || '',
      healthContext: '',
    })

    let reportJson
    const rawContent = (raw && raw.content) ? raw.content : raw
    try { reportJson = parseAIJson(rawContent) }
    catch {
      const textContent = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
      reportJson = {
        riskLevel: 'low', riskScore: 0,
        riskFactors: [], recommendations: [textContent],
        petImbalance: '', qiRisk: '', microbiomeRisk: '',
        lifestyleRisk: '', jointCarePlan: '', medicalAdvice: '',
      }
    }

    const riskLabels = { low: '低风险', medium: '中等风险', high: '高风险' }
    const report = {
      id: `rpt_${Date.now()}`, type: 'risk', typeName: '人宠风险评估',
      petName: pet.name, petId: pet.id,
      time: now(), createdAt: now(),
      ...reportJson,
      riskLevel: {
        level: reportJson.riskLevel || 'low',
        label: riskLabels[reportJson.riskLevel] || '低风险',
      },
    }
    db.reports.push(report)
    res.json({ code: 200, data: report })
  } catch (err) {
    console.error('Coze risk report error:', err.message)
    const report = mockRiskReport(pet)
    db.reports.push(report)
    res.json({ code: 200, data: report, _fallback: true })
  }
})

function mockRiskReport(pet) {
  return {
    id: `rpt_${Date.now()}`, type: 'risk', typeName: '人宠风险评估',
    petName: pet.name, petId: pet.id,
    time: now(), createdAt: now(),
    petImbalance: '气虚倾向', qiRisk: '脾虚湿盛', microbiomeRisk: '肠道菌群偏弱',
    lifestyleRisk: '室内运动不足', jointCarePlan: '每日散步20分钟', medicalAdvice: '定期体检',
    riskLevel: { level: 'medium', label: '中等风险' },
    riskScore: 55,
    riskFactors: [
      { factor: '运动量不足', level: '中' },
      { factor: '饮食结构单一', level: '低' }
    ],
    recommendations: ['增加户外活动', '多样化饮食', '3个月后复查']
  }
}

// ═══════════════════════════════════════════
//  医疗科普指南 (Coze)
// ═══════════════════════════════════════════

app.post('/api/medical/guide', auth, async (req, res) => {
  const { symptom, imageUrl, guideType } = req.body
  const pet = db.pets[0]

  if (!cozeAvailable || !COZE_PROJECTS.chat) {
    return res.json({ code: 200, data: {
      id: `rpt_${Date.now()}`, type: 'medical', typeName: guideType === 'newpet' ? '新宠购买指南' : '医疗科普指南',
      time: now(),
      summary: '根据你的描述，建议优先考虑...',
      guide: [
        { title: '症状分析', desc: `${symptom}常见于消化系统不适或环境变化` },
        { title: '科普建议', desc: '注意观察48小时，保持饮食清淡' },
        { title: '就医指征', desc: '若出现呕吐腹泻发热等，请立即就医' }
      ]
    }})
  }

  try {
    const raw = await cozeChat(COZE_PROJECTS.chat, 'user_001', {
      symptom, imageUrl: imageUrl || '',
      guideType: guideType || 'medical',
    })

    let reportJson
    const rawContent = (raw && raw.content) ? raw.content : raw
    try { reportJson = parseAIJson(rawContent) }
    catch {
      const textContent = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
      reportJson = { summary: textContent, guide: [] }
    }

    res.json({ code: 200, data: {
      id: `rpt_${Date.now()}`, type: 'medical', typeName: guideType === 'newpet' ? '新宠购买指南' : '医疗科普指南',
      time: now(),
      ...reportJson,
    }})
  } catch (err) {
    log.error('Coze medical error:', err.message)
    res.json({ code: 200, data: {
      id: `rpt_${Date.now()}`, type: 'medical',
      time: now(),
      summary: `根据你描述的"${symptom}"，建议密切观察并咨询兽医`,
      guide: [{ title: '请咨询专业兽医', desc: 'AI分析仅供参考，实际诊断请到正规宠物医院' }]
    }, _fallback: true })
  }
})

// ═══════════════════════════════════════════
//  历史报告
// ═══════════════════════════════════════════

app.get('/api/reports', auth, (req, res) => {
  const { type } = req.query
  const reports = type ? db.reports.filter(r => r.type === type) : db.reports
  res.json({ code: 200, data: reports })
})

app.get('/api/reports/:id', auth, (req, res) => {
  const report = db.reports.find(r => r.id === req.params.id)
  if (!report) return res.status(404).json({ message: '报告不存在' })
  res.json({ code: 200, data: report })
})

// ═══════════════════════════════════════════
//  聊天 (Coze 流式)
// ═══════════════════════════════════════════

app.get('/api/chat/sessions', auth, (req, res) => {
  res.json({ code: 200, data: { sessions: db.chatSessions || [] } })
})

app.post('/api/chat/sessions', auth, (req, res) => {
  const { petId } = req.body
  const pet = db.pets.find(p => p.id === petId)
  const greeting = `汪汪！我是${pet?.name || '宠物'}，今天想跟你聊聊天~ 你想跟我说什么呀？`
  const session = {
    id: Date.now(),
    petId,
    petName: pet?.name || '宠物',
    startedAt: now(),
    messages: [
      { id: Date.now(), role: 'pet', content: greeting, at: now() }
    ]
  }
  if (!db.chatSessions) db.chatSessions = []
  db.chatSessions.unshift(session)
  res.json({ code: 200, data: { sessionId: session.id, isNew: true, greeting } })
})

app.get('/api/chat/sessions/:id/messages', auth, (req, res) => {
  const session = (db.chatSessions || []).find(s => s.id === parseInt(req.params.id))
  if (!session) return res.status(404).json({ message: '会话不存在' })
  res.json({ code: 200, data: { sessionId: session.id, petId: session.petId, messages: session.messages } })
})

app.post('/api/chat/send-json', auth, async (req, res) => {
  const { sessionId, message } = req.body
  const session = (db.chatSessions || []).find(s => s.id === sessionId)
  if (!session) return res.status(404).json({ message: '会话不存在' })

  const pet = db.pets.find(p => p.id === session.petId)

  const userMsg = { id: Date.now(), role: 'user', content: message, at: now() }
  session.messages.push(userMsg)

  if (!cozeAvailable || !COZE_PROJECTS.chat) {
    const replies = ['主人你今天心情不错！我超开心~', '我有点想吃零食了，就一点点！', '外面好热闹！我看到小鸟飞过去了~', '摸摸我的头好不好，最喜欢你了', '你今天好像有点累，要好好休息哦']
    const reply = replies[Math.floor(Math.random() * replies.length)]
    const petMsg = { id: Date.now() + 1, role: 'pet', content: reply, at: now() }
    session.messages.push(petMsg)
    return res.json({ code: 200, data: { sessionId, userMessage: userMsg, petMessage: petMsg } })
  }

  try {
    const convHistory = session.messages.slice(-10)
      .map(m => `${m.role === 'user' ? '主人' : (pet?.name || '宠物')}: ${m.content}`)
      .join('\n')

    const raw = await cozeChat(COZE_PROJECTS.chat, 'user_001', {
      petName: pet?.name || '宠物',
      conversation: convHistory,
      latestMessage: message,
      personalityTags: pet?.tags || [],
    })

    const aiReply = (raw && raw.content) ? raw.content
      : (typeof raw === 'string') ? raw
      : JSON.stringify(raw)

    const petMsg = { id: Date.now() + 1, role: 'pet', content: aiReply, at: now() }
    session.messages.push(petMsg)
    res.json({ code: 200, data: { sessionId, userMessage: userMsg, petMessage: petMsg } })
  } catch (err) {
    console.error('Coze chat error:', err.message)
    const fallbacks = ['主人主人，我在这儿呢！', '汪！抱抱～', '今天也很想你哦！']
    const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)]
    const petMsg = { id: Date.now() + 1, role: 'pet', content: reply, at: now() }
    session.messages.push(petMsg)
    res.json({ code: 200, data: { sessionId, userMessage: userMsg, petMessage: petMsg }, _fallback: true })
  }
})// 兼容旧版端点
app.post('/api/chat/sessions/:id/messages', auth, async (req, res) => {
  req.body.sessionId = parseInt(req.params.id)
  // 重新走 send-json 逻辑
  const session = (db.chatSessions || []).find(s => s.id === req.body.sessionId)
  if (!session) return res.status(404).json({ message: '会话不存在' })

  const userMsg = { id: Date.now(), role: 'user', content: req.body.content, at: now() }
  session.messages.push(userMsg)

  const pet = db.pets.find(p => p.id === session.petId)

  if (!cozeAvailable || !COZE_PROJECTS.chat) {
    const replies = ['主人你今天心情不错！', '我有点想吃零食了～', '外面好热闹！', '摸摸我的头好不好', '今天也很想你哦']
    const reply = replies[Math.floor(Math.random() * replies.length)]
    const petMsg = { id: Date.now() + 1, role: 'pet', content: reply, at: now() }
    session.messages.push(petMsg)
    return res.json({ code: 200, data: { sessionId: session.id, userMessage: userMsg, petMessage: petMsg } })
  }

  try {
    // Build conversation context with pet profile for natural chat
    const petProfile = pet
      ? `【宠物档案】名字:${pet.name}, 品种:${pet.breed}, 年龄:${pet.age}, 性别:${pet.gender}, ${pet.neutered ? '已' : '未'}绝育, ${pet.history || '无重大病史'}, 体质:${(pet.tags||[]).join('/')}`
      : ''
    const recentHistory = session.messages.slice(-10)
      .map(m => `${m.role === 'user' ? '主人' : (pet?.name || '宠物')}: ${m.content}`)
      .join('\n')
    const fullContext = petProfile + '\n对话记录:\n' + recentHistory

    const raw = await cozeChat(COZE_PROJECTS.chat, 'user_001', {
      petName: pet?.name || '宠物',
      conversation: recentHistory,
      latestMessage: req.body.content,
      personalityTags: pet?.tags || [],
    })
    const aiReply = (raw && raw.content) ? raw.content
      : (typeof raw === 'string') ? raw
      : JSON.stringify(raw)

    const petMsg = { id: Date.now() + 1, role: 'pet', content: aiReply, at: now() }
    session.messages.push(petMsg)
    res.json({ code: 200, data: { sessionId: session.id, userMessage: userMsg, petMessage: petMsg } })
  } catch (err) {
    log.error('Coze chat error:', err.message)
    const fallbacks = ['主人主人！', '汪！我在呢~', '摸摸头~']
    const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)]
    const petMsg = { id: Date.now() + 1, role: 'pet', content: reply, at: now() }
    session.messages.push(petMsg)
    res.json({ code: 200, data: { sessionId: session.id, userMessage: userMsg, petMessage: petMsg }, _fallback: true })
  }
})

// ═══════════════════════════════════════════
//  商城 / 医院 / 收藏 / 上传
// ═══════════════════════════════════════════

app.get('/api/products', (req, res) => {
  const { category } = req.query
  const products = category ? db.products.filter(p => p.category === category) : db.products
  res.json({ code: 200, data: products })
})

app.get('/api/products/:id', (req, res) => {
  const product = db.products.find(p => p.id === req.params.id)
  if (!product) return res.status(404).json({ message: '商品不存在' })
  res.json({ code: 200, data: product })
})

app.post('/api/orders', auth, (req, res) => {
  const order = { id: `ORD${Date.now()}`, ...req.body, status: 'paid', createdAt: now() }
  db.orders.push(order)
  res.json({ code: 200, data: order })
})

app.get('/api/hospitals', (req, res) => {
  res.json({ code: 200, data: db.hospitals })
})

app.get('/api/hospitals/:id', (req, res) => {
  const hospital = db.hospitals.find(h => h.id === parseInt(req.params.id))
  if (!hospital) return res.status(404).json({ message: '医院不存在' })
  res.json({ code: 200, data: hospital })
})

app.post('/api/upload', auth, (req, res) => {
  res.json({ code: 200, data: { publicUrl: '' } })
})

app.post('/api/favorites/toggle', auth, (req, res) => {
  const { reportId, type } = req.body
  const idx = (db.favorites || []).findIndex(f => f.id === reportId)
  if (idx > -1) {
    (db.favorites || []).splice(idx, 1)
    res.json({ code: 200, data: { favorited: false } })
  } else {
    if (!db.favorites) db.favorites = []
    db.favorites.push({ id: reportId, type, time: now() })
    res.json({ code: 200, data: { favorited: true } })
  }
})

app.get('/api/favorites', auth, (req, res) => {
  res.json({ code: 200, data: db.favorites || [] })
})

// ═══════════════════════════════════════════
//  健康检查
// ═══════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', time: now(),
    coze: cozeAvailable,
    pets: db.pets.length, reports: db.reports.length
  })
})

// ═══════════════════════════════════════════
//  启动
// ═══════════════════════════════════════════

app.listen(PORT, () => {
  log.info('═══════════════════════════════════')
  log.info('  🐾 更懂它 后端已启动')
  log.info(`  📡 http://localhost:${PORT}`)
  log.info(`  🤖 Coze 智能体: ${cozeAvailable ? '✅ 已连接' : '❌ 未配置（降级 mock）'}`)
  log.info(`  🐱 演示宠物: ${db.pets.map(p => p.name).join(', ')}`)
  log.info(`  🛒 商品数: ${db.products.length}`)
  log.info(`  🏥 医院数: ${db.hospitals.length}`)
  log.info('═══════════════════════════════════')
  log.info('')
  log.info('  Coze 端点:')
  log.info('  POST /api/emotion/report   情绪解读')
  log.info('  POST /api/health/report    健康监测')
  log.info('  POST /api/risk/report      风险评估')
  log.info('  POST /api/medical/guide    医疗科普')
  log.info('  POST /api/chat/send-json   AI 聊天')
  log.info('')
})
