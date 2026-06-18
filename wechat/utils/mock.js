const util = require('./util')

const delay = (ms = 800) => new Promise(r => setTimeout(r, ms))

// ========== 宠物模拟数据 ==========
const mockPets = [
  {
    id: 'pet_demo_001',
    name: '小橘',
    breed: '中华田园猫',
    age: '2岁',
    gender: 'male',
    neutered: true,
    history: '曾患轻微猫癣（已愈）',
    vaccine: '三联+狂犬已打',
    tags: ['平和质', '气虚倾向'],
    avatar: '',
    createdAt: '2025-03-15'
  },
  {
    id: 'pet_demo_002',
    name: '旺财',
    breed: '柯基',
    age: '1岁半',
    gender: 'female',
    neutered: false,
    history: '无重大病史',
    vaccine: '卫佳捌+狂犬已打',
    tags: ['平和质'],
    avatar: '',
    createdAt: '2025-08-20'
  }
]

const mockUser = {
  id: 'user_demo_001',
  name: '宠主',
  phone: '13800138000',
  birthday: '1995-06-15',
  avatarUrl: ''
}

// ========== Banner ==========
const mockBanners = [
  { id: 1, tag: '新人礼', title: '免费1个月医疗险', desc: '新用户专享，立即领取', bg: 'linear-gradient(135deg, #F97316, #FB923C)', image: '', url: '/pages/insurance/insurance' },
  { id: 2, tag: '限时活动', title: '灵犀NFC项圈首发', desc: '限量预售，扫码即达', bg: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', image: '', url: '/pages/shop/detail/detail?id=nfc001' },
  { id: 3, tag: '推荐', title: '24小时宠物医院', desc: '查看附近合作医院', bg: 'linear-gradient(135deg, #22C55E, #4ADE80)', image: '', url: '/pages/hospitals/hospitals' }
]

// ========== 医院 ==========
const mockHospitals = [
  { id: 1, name: '瑞鹏宠物医院(南山店)', rating: '4.8', distance: '1.2km', tags: ['24小时', '直付', '中医'], address: '南山区科技园南路100号', image: '' },
  { id: 2, name: '芭比堂动物医院', rating: '4.7', distance: '2.5km', tags: ['康复', '牙科'], address: '福田区莲花路200号', image: '' },
  { id: 3, name: '爱诺动物医院', rating: '4.6', distance: '3.1km', tags: ['急诊', '手术'], address: '宝安区新安路300号', image: '' },
  { id: 4, name: '美联众合动物医院', rating: '4.9', distance: '4.0km', tags: ['综合', 'CT', 'MRI'], address: '罗湖区深南东路400号', image: '' }
]

// ========== 商品 ==========
const mockProducts = [
  { id: 'nfc001', name: '灵犀NFC项圈', desc: '扫码即达·宠物智能身份', price: '299', image: '', category: 'nfc' },
  { id: 'bead001', name: '合香安神香珠', desc: '舒缓情绪·天然合香', price: '168', image: '', category: 'beads' },
  { id: 'bead002', name: '象数水晶·健康款', desc: '能量调理·平衡体质', price: '258', image: '', category: 'beads' },
  { id: 'tag001', name: '智能防丢牌', desc: 'GPS定位·防走失', price: '199', image: '', category: 'nfc' },
  { id: 'food001', name: '冻干生骨肉·鸡肉味', desc: '高蛋白·无添加', price: '89', image: '', category: 'food' },
  { id: 'ins001', name: '宠物医疗险·基础版', desc: '全年保障·直付理赔', price: '299', image: '', category: 'insurance' }
]

// ========== 情绪报告 ==========
const generateEmotionReport = (data) => {
  const pet = mockPets.find(p => p.id === data.petId) || mockPets[0]
  const replies = [
    { coreAnswer: '今天状态不错，心情比较放松，对早餐挺满意的。', basis: '卦象显示离火生坤土' },
    { coreAnswer: '有点小情绪，可能是天气变化影响，不太想动。', basis: '坎水克离火，情绪受抑' },
    { coreAnswer: '精力旺盛，想出去玩，对食物兴趣很大。', basis: '震卦当令，木气生发' }
  ]
  const reply = replies[Math.floor(Math.random() * replies.length)]
  return {
    id: `report_${Date.now()}`,
    type: 'emotion',
    typeName: '情绪解读',
    petName: pet.name,
    petAvatar: pet.avatar,
    petId: pet.id,
    time: util.formatTime(new Date()),
    createdAt: util.formatTime(new Date()),
    question: data.question,
    coreAnswer: reply.coreAnswer,
    coreBasis: reply.basis,
    foodSatisfaction: ['★★☆☆☆', '★★★☆☆', '★★★★☆'][Math.floor(Math.random() * 3)],
    moodLevel: ['★★☆☆☆', '★★★☆☆', '★★★★★'][Math.floor(Math.random() * 3)],
    bodyStatus: '基本正常',
    statusSummary: '今天情绪平稳，对食物接受度尚可，身体无明显不适。午后略微犯困，属正常现象。',
    ownerView: '我感觉你今天有点累，工作压力好大。你摸我的时候手都比平时重一点点。别太辛苦啦，主人超厉害的。',
    petMessage: '妈妈，我想吃那个带汤的罐头～还有，窗户开小一点行吗，风有点凉。但我还是最爱你的。',
    petWish: '今晚能不能早点回家陪我玩十分钟逗猫棒？',
    carePlan: [
      { title: '中兽医养护', desc: '适量温补脾胃，可煮少量鸡胸肉丝搭配南瓜泥。避免生冷食物。' },
      { title: '香疗建议', desc: '使用合香安神香珠放置于常活动区域。檀香、乳香配比舒缓情绪。' },
      { title: '游戏互动', desc: '每天15-20分钟温和逗猫棒游戏，避免过度刺激。' }
    ],
    products: [
      { id: 'bead001', name: '合香安神香珠', price: '168', image: '' },
      { id: 'nfc001', name: '灵犀NFC项圈', price: '299', image: '' }
    ],
    riskLevel: 'low',
    riskText: '低风险',
    summary: reply.coreAnswer.substring(0, 40) + '…',
    favorited: false
  }
}

// ========== 健康报告 ==========
const generateHealthReport = (data) => {
  const pet = mockPets.find(p => p.id === data.petId) || mockPets[0]
  const levels = ['low', 'medium', 'high']
  const level = levels[Math.floor(Math.random() * 3)]
  return {
    id: `report_${Date.now()}`,
    type: 'health',
    typeName: '健康监测',
    petName: pet.name,
    petAvatar: pet.avatar,
    petId: pet.id,
    time: util.formatTime(new Date()),
    createdAt: util.formatTime(new Date()),
    riskLevel: level,
    riskText: util.getRiskLevel(level).text,
    currentSymptoms: level === 'high'
      ? '尿频、尿量减少、频繁舔舐生殖器区域，精神状态萎靡。需紧急关注！'
      : '猫咪出现轻微尿频、舔舐增多，精神状态尚可。',
    symptomMapping: [
      { area: '泌尿系统', symptoms: '尿带隐血、尿频尿急、频繁在猫砂盆附近徘徊、喝水少' },
      { area: '消化系统', symptoms: '食欲轻微下降、偶尔软便' }
    ],
    potentialDeficiencies: '脾肾气虚，膀胱气化不利。中焦运化不足导致水液代谢失调。',
    deficiencyDetails: [
      { type: '肾气不足', manifestations: '不爱动、玩一会就累了、总睡觉没精神、关节可能有轻微不适' },
      { type: '脾胃不足', manifestations: '食欲不振、时长软便、舌头颜色浅淡' }
    ],
    emergency: level === 'high' ? '如出现尿闭（超过12小时无排尿），请立即就医！' : '',
    futureRisk: '重点关注泌尿系统健康，建议定期检查肾功能。脾胃需长期调理，避免寒凉食物。',
    carePlan: [
      { title: '中兽医养护', desc: '温补肾阳，健脾利湿。茯苓、白术、泽泻煎水少量喂服（需遵医嘱）。' },
      { title: '香疗建议', desc: '使用温阳化气类香珠，苍术、艾叶类香气有助于化湿。' },
      { title: '饮食调理', desc: '增加湿粮比例，确保充足饮水。可加蔓越莓提取物辅助泌尿健康。' },
      { title: '保健品', desc: '益生菌调理肠胃，泌尿系统保健营养膏。' },
      { title: '作息建议', desc: '保持环境温暖，减少应激源。每日观察并记录排尿情况。' }
    ],
    summary: level === 'high' ? '泌尿系统高风险预警，需立即关注' : '轻度泌尿系统失调，建议调理',
    favorited: false
  }
}

// ========== 风险报告 ==========
const generateRiskReport = (data) => ({
  id: `report_${Date.now()}`,
  type: 'risk',
  typeName: '风险预警',
  petName: mockPets[0].name,
  time: util.formatTime(new Date()),
  createdAt: util.formatTime(new Date()),
  riskLevel: 'medium',
  riskText: '中风险',
  petImbalance: '当前呈现肾气不足、膀胱气化不利的失衡状态，情绪略低落。体质偏阳虚。',
  qiRisk: '宠物肾气不足常对应主人肾气或泌尿系统处于亚健康状态。人宠同构，长期共处会形成气机同步。建议关注腰部酸软、精力不济、夜尿增多。',
  microbiomeRisk: '共栖菌群研究显示，宠物泌尿菌群失衡可能通过日常接触影响主人微生态平衡。主人若出现皮肤敏感、消化不适，可能与共栖环境相关。',
  lifestyleRisk: '宠物近期饮水减少、活动下降，反映家庭整体作息不规律、环境湿度偏低。请自查：工作压力是否大？熬夜是否频繁？',
  jointCarePlan: '1. 饮食同步：主人多吃黑色食物（黑豆黑芝麻），宠物配温补食材。\n2. 作息同步：固定就寝时间，人宠同步休息。\n3. 运动同步：每日15分钟互动，共同活动助菌群交换。\n4. 环境调理：增加湿度，使用合香香珠改善空间气场。',
  medicalAdvice: '建议主人检查肾功能、泌尿系统。宠物需做尿检。推荐中西医结合门诊。',
  summary: '人宠泌尿系统联动风险，建议共同调理',
  favorited: false
})

// ========== API Mock 实现 ==========
const MockAPI = {
  // 情绪解读
  getEmotionReport: async (data) => {
    await delay(1500)
    return { code: 200, data: generateEmotionReport(data) }
  },

  // 健康监测
  getHealthReport: async (data) => {
    await delay(2000)
    return { code: 200, data: generateHealthReport(data) }
  },

  // 人宠风险
  getRiskReport: async (data) => {
    await delay(2000)
    return { code: 200, data: generateRiskReport(data) }
  },

  // 医疗科普
  getMedicalGuide: async (data) => {
    await delay(1500)
    return { code: 200, data: { guide: '根据症状描述，可能涉及消化系统不适…' } }
  },

  // 收藏
  toggleFavorite: async (reportId, type) => {
    await delay(300)
    const favs = wx.getStorageSync('favorites') || []
    const idx = favs.findIndex(f => f.id === reportId)
    if (idx > -1) { favs.splice(idx, 1); wx.setStorageSync('favorites', favs); return { code: 200, data: { favorited: false } } }
    favs.push({ id: reportId, type, time: util.formatTime(new Date()) })
    wx.setStorageSync('favorites', favs)
    return { code: 200, data: { favorited: true } }
  },

  getFavorites: async () => {
    await delay(500)
    return { code: 200, data: wx.getStorageSync('favorites') || [] }
  },

  // 宠物档案
  getPets: async () => {
    await delay(300)
    const local = wx.getStorageSync('pets')
    return { code: 200, data: local && local.length ? local : mockPets }
  },

  savePet: async (data) => {
    await delay(500)
    const pet = { ...data, id: `pet_${Date.now()}` }
    const pets = wx.getStorageSync('pets') || mockPets
    pets.push(pet)
    wx.setStorageSync('pets', pets)
    return { code: 200, data: pet }
  },

  updatePet: async (id, data) => {
    await delay(500)
    let pets = wx.getStorageSync('pets') || mockPets
    const idx = pets.findIndex(p => p.id === id)
    if (idx > -1) pets[idx] = { ...pets[idx], ...data }
    wx.setStorageSync('pets', pets)
    return { code: 200, data: pets[idx] }
  },

  deletePet: async (id) => {
    await delay(300)
    let pets = wx.getStorageSync('pets') || mockPets
    pets = pets.filter(p => p.id !== id)
    wx.setStorageSync('pets', pets)
    return { code: 200 }
  },

  // 历史报告
  getHistory: async (type) => {
    await delay(500)
    const reports = wx.getStorageSync('reports') || []
    return { code: 200, data: type ? reports.filter(r => r.type === type) : reports }
  },

  getReportDetail: async (id) => {
    await delay(300)
    const reports = wx.getStorageSync('reports') || []
    return { code: 200, data: reports.find(r => r.id === id) }
  },

  // 商城
  getProducts: async (params) => {
    await delay(400)
    let products = mockProducts
    if (params && params.category) products = products.filter(p => p.category === params.category)
    return { code: 200, data: products }
  },

  getProductDetail: async (id) => {
    await delay(300)
    return { code: 200, data: mockProducts.find(p => p.id === id) || mockProducts[0] }
  },

  // 订单
  createOrder: async (data) => {
    await delay(1000)
    return { code: 200, data: { orderId: `ORD${Date.now()}`, status: 'paid' } }
  },

  // 医院
  getHospitals: async (params) => {
    await delay(500)
    return { code: 200, data: mockHospitals }
  },

  getHospitalDetail: async (id) => {
    await delay(300)
    return { code: 200, data: mockHospitals.find(h => h.id === parseInt(id)) || mockHospitals[0] }
  }
}

module.exports = {
  MockAPI,
  mockPets,
  mockUser,
  mockBanners,
  mockHospitals,
  mockProducts
}
