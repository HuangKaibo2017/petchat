const util = require('../../../utils/util')

Page({
  data: {
    report: {},
    riskLevel: {},
    favorited: false
  },

  onLoad(options) {
    const rawData = options.data ? JSON.parse(decodeURIComponent(options.data)) : {}
    const report = this.data.report;
    const reports = wx.getStorageSync('reports') || [];
    reports.unshift(report);
    wx.setStorageSync('reports', reports);
    this.setData({
      report: rawData,
      riskLevel: { label: rawData.healthScore || '★★★☆☆' }
    })
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
