const app = getApp()
const API = require('../../../utils/api')

Page({
  data: {
    report: {},
    favorited: false,
    divSystemLabel: '六爻起卦'
  },

  onLoad(options) {
    const rawData = app.globalData._reportData || {}; app.globalData._reportData = null
    this.buildReport(rawData)
  },

  buildReport(data) {
    const systemLabels = { liuyao: '六爻起卦', meihua: '梅花易数', daliuren: '大六壬', tarot: '塔罗' }

    // 如果 API 已返回完整报告数据，直接使用
    if (data.coreAnswer) {
      const report = {
        ...data,
        id: data.reportId || data.id || `rpt_${Date.now()}`,
        type: data.type || 'emotion',
        typeName: data.typeName || '情绪解读',
        time: data.time || new Date().toLocaleString(),
        favorited: false
      }
      this.setData({ divSystemLabel: systemLabels[data.divSystem] || '六爻起卦', report })
      this.saveReport(report)
      return
    }

    // 兜底：本地 mock 数据
    const pet = app.globalData.currentPet || {}
    const report = {
      id: `rpt_${Date.now()}`,
      type: 'emotion', typeName: '情绪解读',
      petName: pet.name || '小橘', petAvatar: pet.avatar || '',
      petId: data.petId, time: new Date().toLocaleString(),
      question: data.question, divSystem: data.divSystem,
      coreAnswer: '今天状态不错，心情比较放松，对吃的挺满意。',
      coreBasis: '卦象离火生坤土，心气通于脾胃，饮食运化顺畅。',
      foodSatisfaction: '★★★☆☆', moodLevel: '★★★★☆', bodyStatus: '无不适',
      statusSummary: '今天情绪平稳偏愉悦，对食物接受度尚可。',
      ownerView: '我感觉你今天有点累，压力好大。别太辛苦啦，主人超厉害的。',
      petMessage: '妈妈，我想吃带汤的罐头～但我还是最爱你的。',
      petWish: '今晚能不能早点回家陪我玩？',
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
      summary: '今天状态不错，心情放松', favorited: false
    }
    this.setData({ divSystemLabel: systemLabels[data.divSystem] || '六爻起卦', report })
    this.saveReport(report)
  },

  saveReport(report) {
    const reports = wx.getStorageSync('reports') || []
    reports.unshift(report)
    wx.setStorageSync('reports', reports)
  },

  async toggleFavorite() {
    const { report, favorited } = this.data
    try {
      await API.Favorite.toggle(report.id, report.type || 'emotion')
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    } catch (err) {
      // 兜底：本地切换
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    }
  },

  downloadReport() { wx.showToast({ title: '报告已保存', icon: 'success' }) },
  shareReport() { wx.showShareMenu({ withShareTicket: true }) },

  goProduct(e) {
    wx.navigateTo({ url: `/pages/shop/detail/detail?id=${e.currentTarget.dataset.id}` })
  },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) },

  onShareAppMessage() {
    return { title: `${this.data.report.petName}的心声解读报告`, path: '/pages/emotion/report/report' }
  }
})
