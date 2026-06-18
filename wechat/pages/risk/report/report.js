const app = getApp()

Page({
  data: { report: {}, favorited: false },

  onLoad(options) {
    const rawData = options.data ? JSON.parse(decodeURIComponent(options.data)) : {}
    this.buildReport(rawData)
  },

  buildReport(data) {
    // 如果 API 已返回完整报告，直接使用
    if (data.petImbalance) {
      const report = {
        ...data,
        id: data.id || `rpt_${Date.now()}`,
        type: data.type || 'risk',
        typeName: data.typeName || '风险预警',
        time: data.time || new Date().toLocaleString(),
        favorited: false
      }
      this.setData({ report })
      this.saveReport(report)
      return
    }

    // 兜底：本地 mock
    const pet = app.globalData.currentPet || {}
    const report = {
      id: `rpt_${Date.now()}`, type: 'risk', typeName: '风险预警',
      petName: pet.name || '小橘', petId: data.petId,
      time: new Date().toLocaleString(), riskLevel: 'medium', riskText: '中风险',
      petImbalance: '肾气不足、膀胱气化不利的失衡状态，情绪略低落。',
      qiRisk: '宠物肾气不足常对应主人肾气或泌尿亚健康。建议关注腰部酸软、精力不济。',
      microbiomeRisk: '宠物泌尿菌群失衡可能通过日常接触影响主人微生态。',
      lifestyleRisk: '宠物饮水减少、活动下降，反映家庭作息不规律。请自查工作压力与熬夜频率。',
      jointCarePlan: '1.饮食同步：主人多吃黑色食物，宠物温补食材。\n2.作息同步：固定就寝。\n3.运动同步：每日15分钟互动。\n4.环境调理：增加湿度，合香香珠改善气场。',
      medicalAdvice: '建议主人检查肾功能、泌尿系统。宠物做尿检。推荐中西医结合门诊。',
      summary: '人宠泌尿系统联动风险，建议共同调理',
      favorited: false
    }
    this.setData({ report })
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
  shareReport() { wx.showShareMenu({ withShareTicket: true }) },

  onShareAppMessage() {
    return { title: '人宠双向守护报告', path: '/pages/risk/report/report' }
  }
})
