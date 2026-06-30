const app = getApp()

Page({
  data: {
    report: null,
    loading: true,
    petName: '',
    petAvatar: '',
  },

  onLoad(options) {
    // Try to get report from globalData or eventChannel
    const eventChannel = this.getOpenerEventChannel?.()
    if (eventChannel) {
      eventChannel.on('reportData', (data) => {
        this.setReport(data)
      })
    }

    // Fallback: check globalData
    const cached = app.globalData._lastEmotionReport
    if (cached) {
      this.setReport(cached)
      app.globalData._lastEmotionReport = null
    }

    // If still no data, show loading and try to get from params
    if (!this.data.report) {
      setTimeout(() => {
        if (!this.data.report) {
          this.setData({ loading: false })
        }
      }, 2000)
    }
  },

  setReport(report) {
    this.setData({
      report,
      loading: false,
      petName: report.petName || '',
      petAvatar: report.petAvatar || '',
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onShare() {
    wx.showShareMenu({})
  },

  onFavorite() {
    const API = require('../../../utils/api')
    API.Favorite.toggle(this.data.report.id, 'emotion').then(() => {
      wx.showToast({ title: '已收藏', icon: 'success' })
    }).catch(() => {
      wx.showToast({ title: '收藏失败', icon: 'none' })
    })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.petName}的情绪解读报告`,
      path: `/pages/emotion/report/report?id=${this.data.report?.id}`,
    }
  }
})
