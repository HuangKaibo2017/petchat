const express = require('express')
const app = express()
const PORT = 8001

app.use(express.json({ limit: '10mb' }))

// CORS for mini program
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// ==================== 内存数据 ====================
const db = {
  pets: [
    { id: 'pet_001', name: '小橘', breed: '中华田园猫', age: '2岁', gender: 'male', neutered: true, history: '曾患轻微猫癣（已愈）', vaccine: '三联+狂犬已打', tags: ['平和质', '气虚倾向'], avatar: '', createdAt: '2025-03-15' },
    { id: 'pet_002', name: '旺财', breed: '柯基', age: '1岁半', gender: 'female', neutered: false, history: '无重大病史', vaccine: '卫佳捌+狂犬已打', tags: ['平和质'], avatar: '', createdAt: '2025-08-20' }
  ],
  reports: [],
  favorites: [],
  orders: [],
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

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

// ==================== Auth 中间件 ====================
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: '请先登录' })
  req.userId = 'user_001'
  next()
}

// ==================== 宠物档案 ====================
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
  db.pets = db.pets.filter(p => p.id !== req.params.id)
  res.json({ code: 200 })
})

// ==================== 情绪解读报告 ====================
app.post('/api/emotion/report', auth, (req, res) => {
  const { petId, question, divSystem } = req.body
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]
  const report = {
    id: `rpt_${Date.now()}`,
    type: 'emotion', typeName: '情绪解读',
    petId, petName: pet.name, petAvatar: pet.avatar,
    time: now(), createdAt: now(),
    question, divSystem,
    coreAnswer: '今天状态不错，心情放松，对吃的挺满意。',
    coreBasis: '卦象离火生坤土，心气通于脾胃，饮食运化顺畅。',
    foodSatisfaction: '★★★☆☆',
    moodLevel: '★★★★☆',
    bodyStatus: '无不适',
    statusSummary: '今天情绪平稳偏愉悦，对食物接受度尚可。午后略微犯困，属正常。',
    ownerView: '我感觉你今天有点累，压力好大。摸我的时候手比平时重。别太辛苦啦，主人超厉害的。',
    petMessage: '妈妈，我想吃带汤的罐头～还有窗户开小点行吗，风有点凉。但我还是最爱你的。',
    petWish: '今晚能不能早点回家陪我玩十分钟逗猫棒？',
    carePlan: [
      { title: '中兽医养护', desc: '适量温补脾胃，鸡胸肉丝搭南瓜泥。避免生冷食物。' },
      { title: '香疗建议', desc: '合香安神香珠，檀香乳香配比舒缓情绪。' },
      { title: '游戏互动', desc: '每天15-20分钟温和逗猫棒游戏。' }
    ],
    products: [
      { id: 'bead001', name: '合香安神香珠', price: '168', image: '' },
      { id: 'nfc001', name: '灵犀NFC项圈', price: '299', image: '' }
    ],
    riskLevel: 'low', riskText: '安全',
    summary: '今天状态不错，心情放松',
    favorited: false
  }
  db.reports.unshift(report)
  res.json({ code: 200, data: report })
})

// ==================== 健康监测报告 ====================
app.post('/api/health/report', auth, (req, res) => {
  const { petId, symptom, duration, abnormal, numbers } = req.body
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]
  const report = {
    id: `rpt_${Date.now()}`,
    type: 'health', typeName: '健康监测',
    petId, petName: pet.name, petAvatar: pet.avatar,
    time: now(), createdAt: now(),
    symptom, duration, abnormal, numbers,
    riskLevel: 'medium', riskText: '建议关注',
    currentSymptoms: '出现尿频、舔舐增多，精神状态尚可。',
    symptomMapping: [
      { area: '泌尿系统', symptoms: '尿带隐血、尿频尿急、频繁在猫砂盆附近徘徊、喝水少' },
      { area: '消化系统', symptoms: '食欲轻微下降、偶尔软便' }
    ],
    potentialDeficiencies: '脾肾气虚，膀胱气化不利。',
    deficiencyDetails: [
      { type: '肾气不足', manifestations: '不爱动、玩一会就累了、总睡觉没精神' },
      { type: '脾胃不足', manifestations: '食欲不振、时长软便、舌头颜色浅淡' }
    ],
    emergency: '',
    futureRisk: '重点关注泌尿系统，定期检查肾功能。脾胃需长期调理。',
    carePlan: [
      { title: '中兽医养护', desc: '温补肾阳，健脾利湿。茯苓白术泽泻煎水（需遵医嘱）。' },
      { title: '香疗建议', desc: '温阳化气类香珠，苍术艾叶化湿。' },
      { title: '饮食调理', desc: '增加湿粮，充足饮水。加蔓越莓提取物。' },
      { title: '保健品', desc: '益生菌调理肠胃，泌尿保健营养膏。' }
    ],
    summary: '轻度泌尿系统失调，建议调理',
    favorited: false
  }
  db.reports.unshift(report)
  res.json({ code: 200, data: report })
})

// ==================== 人宠风险报告 ====================
app.post('/api/risk/report', auth, (req, res) => {
  const { petId } = req.body
  const pet = db.pets.find(p => p.id === petId) || db.pets[0]
  const report = {
    id: `rpt_${Date.now()}`,
    type: 'risk', typeName: '风险预警',
    petId, petName: pet.name,
    time: now(), createdAt: now(),
    riskLevel: 'medium', riskText: '中风险',
    petImbalance: '肾气不足、膀胱气化不利，情绪略低落。体质偏阳虚。',
    qiRisk: '宠物肾气不足常对应主人肾气或泌尿亚健康。人宠同构，长期共处形成气机同步。建议关注腰部酸软、精力不济。',
    microbiomeRisk: '宠物泌尿菌群失衡可能通过日常接触影响主人微生态。如皮肤敏感、消化不适，可能与共栖环境相关。',
    lifestyleRisk: '宠物饮水减少、活动下降，反映家庭作息不规律、环境湿度偏低。请自查：工作压力、熬夜频率。',
    jointCarePlan: '1.饮食同步：主人多吃黑色食物（黑豆黑芝麻），宠物温补食材。\n2.作息同步：固定就寝，人宠同步休息。\n3.运动同步：每日15分钟互动。\n4.环境调理：增加湿度，合香香珠改善气场。',
    medicalAdvice: '建议主人检查肾功能、泌尿系统。宠物做尿检。推荐中西医结合门诊。',
    summary: '人宠泌尿系统联动风险，建议共同调理',
    favorited: false
  }
  db.reports.unshift(report)
  res.json({ code: 200, data: report })
})

// ==================== 医疗科普 ====================
app.post('/api/medical/guide', auth, (req, res) => {
  res.json({ code: 200, data: { guide: '根据症状描述，可能涉及消化系统不适或环境应激反应。建议暂停新食物，恢复原有饮食，观察48小时。如持续请就医。' } })
})

// ==================== 收藏 ====================
app.post('/api/favorites/toggle', auth, (req, res) => {
  const { reportId, type } = req.body
  const idx = db.favorites.findIndex(f => f.id === reportId)
  if (idx > -1) {
    db.favorites.splice(idx, 1)
    res.json({ code: 200, data: { favorited: false } })
  } else {
    db.favorites.push({ id: reportId, type, time: now() })
    res.json({ code: 200, data: { favorited: true } })
  }
})

app.get('/api/favorites', auth, (req, res) => {
  res.json({ code: 200, data: db.favorites })
})

// ==================== 历史报告 ====================
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

// ==================== 商城 ====================
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

// ==================== 医院 ====================
app.get('/api/hospitals', (req, res) => {
  res.json({ code: 200, data: db.hospitals })
})

app.get('/api/hospitals/:id', (req, res) => {
  const hospital = db.hospitals.find(h => h.id === parseInt(req.params.id))
  if (!hospital) return res.status(404).json({ message: '医院不存在' })
  res.json({ code: 200, data: hospital })
})

// ==================== 健康检查 ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: now(), pets: db.pets.length, reports: db.reports.length })
})

// ==================== 启动 ====================
app.listen(PORT, () => {
  console.log('═══════════════════════════════════')
  console.log('  🐾 Gengdongta 后端已启动')
  console.log(`  📡 http://localhost:${PORT}`)
  console.log(`  🐱 演示宠物: ${db.pets.map(p => p.name).join(', ')}`)
  console.log(`  🛒 商品数: ${db.products.length}`)
  console.log(`  🏥 医院数: ${db.hospitals.length}`)
  console.log('═══════════════════════════════════')
  console.log('')
  console.log('  端点列表:')
  console.log('  GET  /api/health')
  console.log('  GET  /api/pets')
  console.log('  POST /api/emotion/report')
  console.log('  POST /api/health/report')
  console.log('  POST /api/risk/report')
  console.log('  GET  /api/reports')
  console.log('  GET  /api/products')
  console.log('  GET  /api/hospitals')
  console.log('  ... (共 18 个端点)')
  console.log('')
})
