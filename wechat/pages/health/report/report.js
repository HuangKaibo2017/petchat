const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    report: {},
    riskLevel: {},
    favorited: false
  },

  onLoad(options) {
    const rawData = options.data ? JSON.parse(decodeURIComponent(options.data)) : {}
    this.buildReport(rawData)
  },

  buildReport(data) {
    // 如果 API 已返回完整报告数据，直接使用
    if (data.riskLevel) {
      const riskLevel = util.getRiskLevel(data.riskLevel)
      const report = {
        ...data,
        id: data.id || `rpt_${Date.now()}`,
        type: data.type || 'health',
        typeName: data.typeName || '健康监测',
        time: data.time || new Date().toLocaleString(),
        riskText: riskLevel.text,
        favorited: false
      }
      this.setData({
        report,
        riskLevel: { ...riskLevel, icon: data.riskLevel === 'high' ? '🚨' : data.riskLevel === 'medium' ? '⚠️' : '✅', desc: data.riskLevel === 'high' ? '建议立即就医' : '建议关注' }
      })
      this.saveReport(report)
      return
    }

    // 兜底：本地 mock
    const pet = app.globalData.currentPet || {}
    const level = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
    const riskLevel = util.getRiskLevel(level)
    const report = {
      id: `rpt_${Date.now()}`, type: 'health', typeName: '健康监测',
      petName: pet.name || '小橘', petAvatar: pet.avatar || '',
      petId: data.petId, time: new Date().toLocaleString(),
      symptom: data.symptom, duration: data.duration,
      riskLevel: level, riskText: riskLevel.text,
      currentSymptoms: level === 'high' ? '尿频、尿量减少、精神萎靡。需紧急关注！' : '出现尿频、舔舐增多，精神状态尚可。',
      symptomMapping: [
        { area: '泌尿系统', symptoms: '尿带隐血、尿频尿急、频繁在猫砂盆附近徘徊、喝水少' },
        { area: '消化系统', symptoms: '食欲轻微下降、偶尔软便' }
      ],
      potentialDeficiencies: '脾肾气虚，膀胱气化不利。',
      deficiencyDetails: [
        { type: '肾气不足', manifestations: '不爱动、玩一会就累了、总睡觉没精神' },
        { type: '脾胃不足', manifestations: '食欲不振、时长软便、舌头颜色浅淡' }
      ],
      emergency: level === 'high' ? '如出现尿闭（超过12小时无排尿），请立即就医！' : '',
      futureRisk: '重点关注泌尿系统健康，定期检查肾功能。',
      carePlan: [
        { title: '中兽医养护', desc: '温补肾阳，健脾利湿。茯苓白术泽泻煎水（需遵医嘱）。' },
        { title: '香疗建议', desc: '温阳化气类香珠，苍术艾叶化湿。' },
        { title: '饮食调理', desc: '增加湿粮，充足饮水。加蔓越莓提取物。' },
        { title: '保健品', desc: '益生菌调理肠胃，泌尿保健营养膏。' }
      ],
      summary: level === 'high' ? '泌尿系统高风险预警' : '轻度泌尿系统失调，建议调理',
      favorited: false
    }
    this.setData({
      report,
      riskLevel: { ...riskLevel, icon: level === 'high' ? '🚨' : level === 'medium' ? '⚠️' : '✅', desc: level === 'high' ? '建议立即就医' : '建议关注' }
    })
    this.saveReport(report)
  },

  saveReport(report) {
    const reports = wx.getStorageSync('reports') || []
    reports.unshift(report)
    wx.setStorageSync('reports', reports)
  },

  toggleFavorite() {
    this.setData({ favorited: !this.data.favorited })
    wx.showToast({ title: this.data.favorited ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  goHospitals() { wx.navigateTo({ url: '/pages/hospitals/hospitals' }) },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) },
  shareReport() { wx.showShareMenu({ withShareTicket: true }) },

  onShareAppMessage() {
    return { title: `${this.data.report.petName}的健康监测报告`, path: '/pages/health/report/report' }
  }
})
