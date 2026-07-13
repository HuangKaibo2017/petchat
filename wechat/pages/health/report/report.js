const app = getApp()

Page({
  data: {
    report: null,
    loading: true,
    petName: '',
  },

  onLoad(options) {
    const eventChannel = this.getOpenerEventChannel?.()
    if (eventChannel) {
      eventChannel.on('reportData', (data) => this.setReport(data))
    }
    const cached = app.globalData._lastHealthReport
    if (cached) {
      this.setReport(cached)
      app.globalData._lastHealthReport = null
    }
    if (!this.data.report) {
      setTimeout(() => {
        if (!this.data.report) this.setData({ loading: false })
      }, 2000)
    }
  },

  setReport(report) {
    const carePlan = Array.isArray(report.carePlan) ? report.carePlan : []
    const healthPercent = typeof report.healthScore === 'number'
      ? report.healthScore
      : (report.healthScore && report.healthScore.match ? (report.healthScore.match(/★/g) || []).length * 20 : 80)

    this.setData({
      report,
      loading: false,
      petName: report.petName || '',
      healthPercent,
      carePlan,
    })
  },

  goBack() { wx.navigateBack() },

  onFavorite() {
    const API = require('../../../utils/api')
    API.Favorite.toggle(this.data.report.id, 'health').then(() => {
      wx.showToast({ title: '已收藏', icon: 'success' })
    }).catch(() => wx.showToast({ title: '收藏失败', icon: 'none' }))
  },

  onShareAppMessage() {
    return {
      title: `${this.data.petName}的健康监测报告`,
      path: `/pages/health/report/report?id=${this.data.report?.id}`,
    }
  }
})
