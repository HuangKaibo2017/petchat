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

// ═══════════════════════════════════════════
//  内置智能体引擎
// ═══════════════════════════════════════════

const llm     = require('./src/core/llm')
const memory  = require('./src/core/memory')
const router  = require('./src/core/router')
const agents  = require('./src/agents/registry')

// ═══════════════════════════════════════════
//  模拟数据库
// ═══════════════════════════════════════════

const db = {
  pets: [
    { id: 'pet_001', name: '旺财', breed: '金毛', age: 3, tags: ['活泼', '贪吃', '友善'] },
    { id: 'pet_002', name: '小花', breed: '英短蓝猫', age: 2, tags: ['高冷', '爱睡觉', '挑食'] },
  ],
  reports: [],
  sessions: {},         // { sessionId: { petId, messages: [] } }
  orders: [],
  hospitals: [
    { id: 1, name: '宠爱国际动物医院', address: '北京市朝阳区建国路88号', phone: '010-88886666', rating: 4.8 },
    { id: 2, name: '瑞鹏宠物医院', address: '北京市海淀区中关村大街1号', phone: '010-66668888', rating: 4.6 },
  ],
  products: [
    { id: 'p001', name: '皇家猫粮 2kg', price: 168, category: 'food', image: '' },
    { id: 'p002', name: '宠物自动喂食器', price: 299, category: 'device', image: '' },
    { id: 'p003', name: '逗猫棒套装', price: 29, category: 'toy', image: '' },
    { id: 'p004', name: '犬用钙片 120片', price: 89, category: 'health', image: '' },
  ],
  favorites: [],
}

// 启动时加载健康检查工具
require('./src/tools/health')

// ═══════════════════════════════════════════
//  Auth 中间件（简化版）
// ═══════════════════════════════════════════

function auth(req, res, next) {
  const token = req.headers.authorization
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }
  // 简化：直接取 token 作为 userId
  req.userId = token.replace('Bearer ', '')
  next()
}

// ═══════════════════════════════════════════
//  Agent 智能体端点
// ═══════════════════════════════════════════

/**
 * 情绪解读
 */
app.post('/api/emotion/report', async (req, res) => {
  try {
    const { petId, sessionId, content, question, divSystem, numbers, imageUrl } = req.body
    const pet = db.pets.find(p => p.id === petId) || db.pets[0]
    const sid = sessionId || 'emo_' + Date.now()

    // numbers 长度为 1 → 一事一问，否则 → 多维度
    const mode = (numbers && numbers.length === 1) ? 'single' : 'multi'

    const report = await agents.get('mood').run({
      sessionId: sid,
      userMessage: content || question,
      petInfo: {
        name: pet.name,
        breed: pet.breed,
        age: pet.age,
        question: question || content,
        divSystem,
        numbers: numbers || [],
      },
      mode,
    })

    const saved = {
      id: 'rpt_' + Date.now(),
      petId: pet.id,
      petName: pet.name,
      petAvatar: pet.avatar || '',
      ...report,
      divSystem,
      createdAt: now(),
    }
    db.reports.push(saved)

    res.json({ code: 200, data: saved })
  } catch (err) {
    console.error('[mood] error:', err.message)
    const fallback = {
      id: 'rpt_' + Date.now(),
      type: 'emotion', typeName: '情绪解读',
      petName: (db.pets[0] || {}).name || '小橘',
      petAvatar: '',
      coreAnswer: '今天状态不错，心情比较放松~',
      coreBasis: '从能量状态来看，整体平稳。',
      foodSatisfaction: '★★★☆☆', moodLevel: '★★★★☆', bodyStatus: '无不适',
      statusSummary: '今天情绪平稳偏愉悦。',
      ownerView: '主人今天看起来有点累，要注意休息哦。',
      petMessage: '妈妈，我想你了，今晚早点回家陪我玩吧！',
      petWish: '希望能多陪我一会',
      carePlan: [
        { title: '日常互动', desc: '每天15分钟陪伴游戏，增进感情。' },
        { title: '饮食均衡', desc: '保持规律喂食，适量添加营养。' },
        { title: '环境舒适', desc: '确保安静舒适的休息空间。' },
      ],
      products: [],
      riskLevel: 'low', riskText: '安全',
      summary: '状态良好，继续关注',
      divSystem: divSystem || 'liuyao',
      createdAt: now(),
    }
    res.json({ code: 200, data: fallback, _fallback: true })
  }
})

app.post('/api/health/report', async (req, res) => {
  try {
    const { petId, sessionId, content } = req.body
    const pet = db.pets.find(p => p.id === petId) || db.pets[0]
    const sid = sessionId || `hlth_${Date.now()}`

    const reply = await agents.get('health').run({
      sessionId: sid,
      userMessage: content || req.body.description,
      petInfo: { name: pet.name, breed: pet.breed, age: pet.age },
    })

    res.json({ code: 200, data: { report: reply, sessionId: sid, pet } })
  } catch (err) {
    console.error('[health] error:', err.message)
    res.json({ code: 200, data: {
      report: '我收到你的描述了。建议观察{{petName}}的精神状态和食欲，如果有持续异常请及时就医。',
      pet: db.pets[0],
    }, _fallback: true })
  }
})

/**
 * 风险评估 — 人宠共生体质报告（爱宠如照镜）
 */
app.post('/api/risk/report', async (req, res) => {
  try {
    const { petId, sessionId } = req.body
    const pet = db.pets.find(p => p.id === petId) || db.pets[0]
    const sid = sessionId || `risk_${Date.now()}`

    const report = await agents.get('risk').run({
      sessionId: sid,
      userMessage: `请生成${pet.name}（${pet.breed}）的人宠共生体质报告。注意：只有主人在某方面确实可能有体质问题时，才生成对应的警示。主人身体警示内容只基于宠物表现和生活习惯分析，严禁提及出生日期、出生时间等个人信息。`,
      petInfo: {
        name: pet.name,
        breed: pet.breed,
        age: pet.age,
        type: pet.type || (pet.breed && pet.breed.includes('猫') ? '猫' : '狗'),
        gender: pet.neutered ? `${pet.gender === 'male' ? '公' : '母'}·已绝育` : `${pet.gender === 'male' ? '公' : '母'}·未绝育`,
        weight: pet.weight || '未知',
        numbers: pet.tags && pet.tags.length ? pet.tags.join('、') : '',
      },
    })

    // Parse JSON (robust extraction)
    let reportData
    let jsonStr = report
    try {
      // Strategy 1: Try markdown code block extraction (supports both ```json and ```)
      const mdMatch = report.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (mdMatch) jsonStr = mdMatch[1].trim()

      // Strategy 2: Extract from first { to matching }
      const braceStart = jsonStr.indexOf('{')
      if (braceStart >= 0) {
        let depth = 0, braceEnd = -1
        for (let i = braceStart; i < jsonStr.length; i++) {
          if (jsonStr[i] === '{') depth++
          else if (jsonStr[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break } }
        }
        if (braceEnd >= 0) jsonStr = jsonStr.slice(braceStart, braceEnd + 1)
      }

      reportData = JSON.parse(jsonStr.trim())
    } catch (parseErr) {
      console.warn('[risk] JSON parse failed, falling back:', parseErr.message.slice(0, 80))
      // Try to extract meaningful text from raw response
      const rawText = report.replace(/```[\s\S]*?```/g, '').replace(/[{}\[\]"':,\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim()
      reportData = {
        petConstitution: '平和质（AI分析中）',
        petCoreState: rawText.slice(0, 200) || '宠物状态良好，主人生活方式与宠物健康紧密相连。',
        petIssues: [],
        ownerMirrorAnalysis: { title: '主人体质镜像分析', description: rawText.slice(0, 300) || '通过宠物的日常表现，可以温和映照主人的健康状态。', items: [] },
        ownerWarnings: [],
        ownerBadHabits: [],
        microbeExplanation: '主人与宠物共同生活时，会通过日常接触共享皮肤和肠道的微生物群落，形成独特的「家庭微生态」。这种菌群共栖现象是先天具备的生理机制。',
        epigeneticsExplanation: '共同的生活环境会通过饮食、作息、压力等方式影响基因表达模式，这并非改变基因本身，而是影响哪些基因被「打开」或「关闭」。',
        convergenceChanges: { description: '长期共同生活后，主人与宠物在作息节律、情绪周期、甚至代谢模式上会出现同步趋势，研究显示共同生活一年以上的家庭，人宠皮质醇节律相似度可达60%以上。', recommendations: [] },
        sharedPoints: { sleep: '保持规律的作息时间。', diet: '注意饮食均衡。', emotion: '情绪稳定对双方都有益。' },
        ownerInfluence: rawText.slice(0, 300) || '主人的生活习惯对爱宠有深远影响，建议从作息、饮食、情绪三方面共同调理。',
        petRisks: [],
        carePlan: { pet: [], owner: [] },
        conclusion: '以上内容仅供参考，不替代执业兽医诊断。如有不适请及时就医。',
      }
    }

    res.json({ code: 200, data: { report: reportData, pet, sessionId: sid } })
  } catch (err) {
    console.error('[risk] error:', err.message)
    res.json({ code: 200, data: {
      report: { petConstitution: '平和质', conclusion: '报告生成暂时失败，请稍后重试。' },
      pet: db.pets[0],
    }, _fallback: true })
  }
})

/**
 * 宠物体质综合分析报告（中医体质风）
 */
app.post('/api/constitution/report', async (req, res) => {
  try {
    const { petId, numbers, sessionId } = req.body
    const pet = db.pets.find(p => p.id === petId) || db.pets[0]
    const sid = sessionId || `const_${Date.now()}`

    const report = await agents.get('constitution').run({
      sessionId: sid,
      userMessage: `请为这只宠物生成完整的健康体质综合分析报告。`,
      petInfo: {
        name: pet.name,
        breed: pet.breed,
        age: pet.age,
        type: pet.type || (pet.breed && pet.breed.includes('猫') ? '猫' : '狗'),
        gender: pet.neutered ? `${pet.gender === 'male' ? '公' : '母'}·已绝育` : `${pet.gender === 'male' ? '公' : '母'}·未绝育`,
        weight: pet.weight || '未提供',
        numbers: numbers || '未提供',
      },
    })

    res.json({ code: 200, data: { report, pet, sessionId: sid } })
  } catch (err) {
    console.error('[constitution] error:', err.message)
    res.json({ code: 200, data: {
      report: '体质分析暂时无法生成，请稍后重试。',
      pet: db.pets[0],
    }, _fallback: true })
  }
})

/**
 * 新宠购买建议
 */
app.post('/api/newpet/guide', async (req, res) => {
  try {
    const { description, sessionId } = req.body
    const sid = sessionId || `newpet_${Date.now()}`

    const reply = await agents.get('newpet').run({
      sessionId: sid,
      userMessage: description || '请根据一般情况推荐',
      petInfo: {},
    })

    // Parse JSON
    let guideData
    try {
      let jsonStr = reply
      const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1]
      else {
        const braceIdx = reply.indexOf('{')
        if (braceIdx >= 0) jsonStr = reply.slice(braceIdx)
      }
      guideData = JSON.parse(jsonStr.trim())
    } catch (parseErr) {
      console.warn('[newpet] JSON parse failed:', parseErr.message)
      guideData = { summary: reply, recommendations: [], disclaimer: '以上为AI推荐参考。领养代替购买。' }
    }

    res.json({ code: 200, data: { guide: guideData, sessionId: sid } })
  } catch (err) {
    console.error('[newpet] error:', err.message)
    res.json({ code: 200, data: {
      guide: { summary: '暂时无法生成建议，请稍后重试。', recommendations: [], disclaimer: '领养代替购买。' },
    }, _fallback: true })
  }
})

/**
 * 医疗科普（结构化JSON输出 + 全面宠物数据）
 */
app.post('/api/medical/guide', async (req, res) => {
  try {
    const { petId, symptom, answers, imageUrl, constitutionRef, sessionId } = req.body
    const pet = db.pets.find(p => p.id === petId) || db.pets[0]
    const sid = sessionId || `med_${Date.now()}`

    // Build comprehensive pet info
    const petInfo = []
    if (pet.breed) petInfo.push(`品种：${pet.breed}`)
    if (pet.age) petInfo.push(`年龄：${pet.age}`)
    if (pet.gender) petInfo.push(`性别：${pet.gender === 'male' ? '公' : '母'}，${pet.neutered ? '已绝育' : '未绝育'}`)
    if (pet.weight) petInfo.push(`体重：${pet.weight}kg`)
    if (pet.history) petInfo.push(`病史：${pet.history}`)
    if (pet.vaccine) petInfo.push(`疫苗：${pet.vaccine}`)
    if (pet.tags && pet.tags.length) petInfo.push(`体质标签：${pet.tags.join('、')}`)

    // Build constitution part if available
    let constitutionPart = ''
    if (constitutionRef) {
      constitutionPart = `\n体质报告参考：${constitutionRef}`
    }

    // Build user message
    let userMessage = `请基于以下信息生成宠物临床科普：\n症状：${symptom || '未描述'}\n宠物信息：${petInfo.join('；') || '未提供'}`
    if (answers && Object.keys(answers).length > 0) {
      userMessage += `\n用户补充回答：${JSON.stringify(answers)}`
    }
    if (imageUrl) {
      userMessage += `\n用户上传了检查报告/照片`
    }

    const reply = await agents.get('consultation').run({
      sessionId: sid,
      userMessage,
      petInfo: {
        name: pet.name,
        breed: pet.breed,
        age: pet.age,
        type: pet.type || (pet.breed && pet.breed.includes('猫') ? '猫' : '狗'),
        gender: pet.neutered ? `${pet.gender === 'male' ? '公' : '母'}·已绝育` : `${pet.gender === 'male' ? '公' : '母'}·未绝育`,
        weight: pet.weight || '未知',
        numbers: constitutionRef ? '体质报告已提供' : '',
      },
    })

    // Try to parse JSON from LLM response
    let guideData
    try {
      // Strip possible markdown code blocks
      let jsonStr = reply
      const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1]
      else {
        const braceIdx = reply.indexOf('{')
        if (braceIdx >= 0) jsonStr = reply.slice(braceIdx)
      }
      guideData = JSON.parse(jsonStr.trim())
    } catch (parseErr) {
      console.warn('[medical] JSON parse failed, using raw text:', parseErr.message)
      guideData = { judgment: reply, symptomExplain: '', disclaimer: '以上内容为兽医临床常识科普，仅供学习参考，不替代执业兽医面诊，宠物个体用药请在兽医指导下进行。' }
    }

    // Generate dynamic follow-up questions based on symptom
    const followUpQuestions = generateFollowUpQuestions(symptom || '')

    res.json({
      code: 200,
      data: {
        guide: guideData,
        followUpQuestions,
        pet,
        sessionId: sid,
      },
    })
  } catch (err) {
    console.error('[consultation] error:', err.message)
    res.json({ code: 200, data: {
      guide: { judgment: '这个问题我暂时无法回答，建议咨询专业兽医。你可以换个方式描述一下？', disclaimer: '以上内容为兽医临床常识科普，仅供学习参考，不替代执业兽医面诊，宠物个体用药请在兽医指导下进行。' },
      followUpQuestions: [],
      pet: db.pets[0],
    }, _fallback: true })
  }
})

/**
 * Generate follow-up questions based on symptom
 */
function generateFollowUpQuestions(symptom) {
  const symptomLower = (symptom || '').toLowerCase()
  const questions = [
    { id: 1, text: '这些症状出现多久了？', options: ['1天以内', '1-3天', '3-7天', '7天以上'] },
    { id: 2, text: '宠物近期体重有无明显变化？', options: ['无变化', '变轻了', '变重了'] },
    { id: 3, text: '发病前有无诱因？', options: ['无明显诱因', '换粮', '着凉', '洗澡', '外出', '应激'] },
  ]
  if (symptomLower.includes('呕吐') || symptomLower.includes('拉稀') || symptomLower.includes('腹泻')) {
    questions.push({ id: 4, text: '呕吐/腹泻物的形态？', options: ['食物残渣', '黄绿色液体', '带血', '水样'] })
  } else if (symptomLower.includes('皮肤') || symptomLower.includes('瘙痒') || symptomLower.includes('掉毛')) {
    questions.push({ id: 4, text: '皮肤问题主要分布在哪里？', options: ['全身', '局部', '耳朵', '四肢', '腹部'] })
  } else if (symptomLower.includes('尿') || symptomLower.includes('膀胱')) {
    questions.push({ id: 4, text: '是否有尿血或尿频？', options: ['有血', '无血但频繁', '正常'] })
  }
  return questions
}

/**
 * 医疗追问对话（教授风格）
 */
app.post('/api/medical/followup', async (req, res) => {
  try {
    const { petId, sessionId, question, context } = req.body
    const pet = db.pets.find(p => p.id === petId) || db.pets[0]
    const sid = sessionId || `med_follow_${Date.now()}`

    const contextStr = context
      ? `宠物信息：${pet.breed || '未知品种'}，${pet.age || '未知年龄'}，${pet.gender === 'male' ? '公' : '母'}，${pet.neutered ? '已绝育' : '未绝育'}。此前讨论：${context}`
      : `宠物信息：${pet.breed || '未知品种'}，${pet.age || '未知年龄'}`

    const followupPrompt = `你是「更懂它」宠物临床健康科普专家，扮演一位资深的宠物医学教授，正在给学生（宠物主人）上一堂生动的宠物健康课。

【你的身份】
- 资深宠物医学教授、临床专家
- 教学风格：专业、耐心、深入浅出、善于用通俗语言解释专业问题
- 像在诊室里给宠物主人上课一样

【学生（用户）的情况】
${contextStr}

【学生（用户）的问题/描述】
${question || '请继续讲解'}

【你的回复要求 - 非常重要】
作为一位宠物医学教授，你要：
1. 专业且易懂：用通俗的语言解释专业的医学问题，让学生能理解
2. 针对性回答：认真理解学生的问题，给出针对性的答案，不是泛泛而谈
3. 教学互动感：像上课一样，有互动感，可以用"你问得很好"、"这个问题很关键"等
4. 多维度分析：从临床、西医、中医、营养、养护等多个角度分析
5. 实用建议：给出切实可行的解决方案，而不是空泛的理论

【回复风格示例】
- "你问的这个问题非常好..."
- "这个问题我们需要从几个方面来看..."
- "让我给你详细讲解一下..."
- "根据临床经验，我建议..."

【回复结构】（根据问题灵活调整）
1. 肯定学生的问题（你问得很好/这是个很关键的问题）
2. 针对性分析（结合具体情况给出专业分析）
3. 详细讲解（用通俗语言解释专业知识）
4. 具体建议（切实可行的方案）
5. 总结提醒（温柔关怀）

【专业口吻】
- 像一位坐在诊室里耐心的教授在给学生分析问题
- 站在用户角度思考实际问题，给出切实可行的方案
- 结尾包含："以上内容仅供参考，不替代执业兽医诊断，宠物用药请在兽医指导下进行"

请用中文，像一位宠物医学教授给学生上课一样，温暖专业地回复。`

    const reply = await agents.get('consultation').run({
      sessionId: sid,
      userMessage: followupPrompt,
      petInfo: {
        name: pet.name,
        breed: pet.breed,
        age: pet.age,
      },
    })

    res.json({ code: 200, data: { reply, sessionId: sid } })
  } catch (err) {
    console.error('[followup] error:', err.message)
    res.json({ code: 200, data: {
      reply: '抱歉，我暂时无法回答这个问题。建议您咨询专业兽医获取更准确的建议。',
    }, _fallback: true })
  }
})

/**
 * 智能聊天 — 流式
 */
app.post('/api/chat/send', async (req, res) => {
  const { petId, sessionId, content } = req.body || {}
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]
  const sid = sessionId || `chat_${Date.now()}`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    // 意图路由
    const agentName = await router.route(sid, content)
    const agent = agents.get(agentName)

    await agent.runStream({
      sessionId: sid,
      userMessage: content,
      petInfo: { name: pet.name, breed: pet.breed, age: pet.age },
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ content: token })}\n\n`)
      },
    })

    res.write('data: [DONE]\n\n')
  } catch (err) {
    console.error('[chat stream] error:', err.message)
    const fallback = ['主人主人！', '汪！我在呢~', '摸摸头~', '喵~想你了！']
    const reply = fallback[Math.floor(Math.random() * fallback.length)]
    res.write(`data: ${JSON.stringify({ content: reply })}\n\n`)
    res.write('data: [DONE]\n\n')
  }
  res.end()
})

/**
 * 智能聊天 — 非流式
 */
app.post('/api/chat/send-json', async (req, res) => {
  const { petId, sessionId, content } = req.body || {}
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]
  const sid = sessionId || `chat_${Date.now()}`

  // 获取或创建 session
  if (!db.sessions[sid]) {
    db.sessions[sid] = { id: sid, petId: pet.id, messages: [], createdAt: now() }
  }
  const session = db.sessions[sid]

  try {
    // 意图路由
    const agentName = await router.route(sid, content)
    const agent = agents.get(agentName)

    const aiReply = await agent.run({
      sessionId: sid,
      userMessage: content,
      petInfo: { name: pet.name, breed: pet.breed, age: pet.age },
    })

    const userMsg = { id: Date.now(), role: 'user', content, at: now() }
    const petMsg  = { id: Date.now() + 1, role: 'pet', content: aiReply, at: now(), agent: agentName }
    session.messages.push(userMsg, petMsg)

    res.json({ code: 200, data: { sessionId: sid, userMessage: userMsg, petMessage: petMsg } })
  } catch (err) {
    console.error('[chat json] error:', err.message)
    const fallbacks = ['主人主人！', '汪！我在呢~', '摸摸头~']
    const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)]
    const userMsg = { id: Date.now(), role: 'user', content, at: now() }
    const petMsg  = { id: Date.now() + 1, role: 'pet', content: reply, at: now() }
    session.messages.push(userMsg, petMsg)
    res.json({ code: 200, data: { sessionId: sid, userMessage: userMsg, petMessage: petMsg }, _fallback: true })
  }
})

// ═══════════════════════════════════════════
//  宠物档案 / 报告查询
// ═══════════════════════════════════════════

app.get('/api/pets', (req, res) => {
  res.json({ code: 200, data: db.pets })
})

app.get('/api/pets/:id', (req, res) => {
  const pet = db.pets.find(p => p.id === req.params.id)
  if (!pet) return res.status(404).json({ code: 404, message: '宠物不存在' })
  res.json({ code: 200, data: pet })
})

app.post('/api/pets', auth, (req, res) => {
  const pet = { id: `pet_${Date.now()}`, ...req.body }
  db.pets.push(pet)
  res.json({ code: 200, data: pet })
})

app.get('/api/reports', auth, (req, res) => {
  const { petId } = req.query
  const reports = petId ? db.reports.filter(r => r.petId === petId) : db.reports
  res.json({ code: 200, data: reports })
})

app.post('/api/reports', auth, (req, res) => {
  const report = { id: `rpt_${Date.now()}`, ...req.body, createdAt: now() }
  db.reports.push(report)
  res.json({ code: 200, data: report })
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
    llm: llm.available(),
    agents: agents.list(),
    sessions: memory.count(),
    pets: db.pets.length,
    reports: db.reports.length,
  })
})

// ═══════════════════════════════════════════
//  启动
// ═══════════════════════════════════════════

app.listen(PORT, async () => {
  console.log('═══════════════════════════════════')
  console.log('  🐾 更懂它 后端已启动')
  console.log(`  📡 http://localhost:${PORT}`)

  // 异步检查 LLM 连通性
  llm.ping().then(ok => {
    console.log(`  🤖 智能体引擎: ${ok ? '✅ Qwen 已连接' : '⚠️  LLM_API_KEY 未配置（降级 mock）'}`)
  })

  console.log(`  🐱 演示宠物: ${db.pets.map(p => p.name).join(', ')}`)
  console.log(`  🛒 商品数: ${db.products.length}`)
  console.log(`  🏥 医院数: ${db.hospitals.length}`)
  console.log('═══════════════════════════════════')
  console.log('')
  console.log('  智能体端点:')
  console.log('  POST /api/emotion/report   情绪解读')
  console.log('  POST /api/health/report    健康监测')
  console.log('  POST /api/constitution/report  体质综合分析')
  console.log('  POST /api/risk/report      风险评估')
  console.log('  POST /api/newpet/guide     新宠购买建议')
  console.log('  POST /api/medical/guide    医疗科普')
  console.log('  POST /api/medical/followup  追问对话')
  console.log('  POST /api/chat/send        流式聊天')
  console.log('  POST /api/chat/send-json   非流式聊天')
  console.log('')
})
