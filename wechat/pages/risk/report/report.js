const app = getApp()

Page({
  data: {
    report: null,
    loading: true,
    petName: '',
    riskFactors: [],
  },

  onLoad(options) {
    const eventChannel = this.getOpenerEventChannel?.()
    if (eventChannel) {
      eventChannel.on('reportData', (data) => this.setReport(data))
    }
    const cached = app.globalData._lastRiskReport
    if (cached) {
      this.setReport(cached)
      app.globalData._lastRiskReport = null
    }
    if (!this.data.report) {
      setTimeout(() => {
        if (!this.data.report) this.setData({ loading: false })
      }, 2000)
    }
  },

  setReport(report) {
    let factors = report.riskFactors
    if (typeof factors === 'string') {
      try { factors = JSON.parse(factors) } catch { factors = [] }
    }
    if (!Array.isArray(factors)) factors = []

    const levelMap = { low: '#2ecc71', medium: '#f39c12', high: '#e74c3c', severe: '#c0392b' }
    const levelText = { low: '低风险', medium: '中等风险', high: '高风险', severe: '严重风险' }

    this.setData({
      report,
      loading: false,
      petName: report.petName || '',
      riskFactors: factors,
      riskColor: levelMap[report.riskLevel] || '#f39c12',
      riskText: levelText[report.riskLevel] || '未知',
    })
  },

  goBack() { wx.navigateBack() },

  onFavorite() {
    const API = require('../../../utils/api')
    API.Favorite.toggle(this.data.report.id, 'risk').then(() => {
      wx.showToast({ title: '已收藏', icon: 'success' })
    }).catch(() => wx.showToast({ title: '收藏失败', icon: 'none' }))
  },

  onShareAppMessage() {
    return {
      title: `${this.data.petName}的风险评估报告`,
      path: `/pages/risk/report/report?id=${this.data.report?.id}`,
    }
  }
})
