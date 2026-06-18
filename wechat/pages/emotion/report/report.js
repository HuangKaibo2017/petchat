const app = getApp()
const API = require('../../../utils/api')

Page({
  data: {
    report: {},
    favorited: false,
    divSystemLabel: '六爻起卦'
  },

  onLoad(options) {
    const rawData = options.data ? JSON.parse(decodeURIComponent(options.data)) : {}

    const systemLabels = { liuyao: '六爻起卦', meihua: '梅花易数', daliuren: '大六壬', tarot: '塔罗' }

    const report = this.data.report;
    const reports = wx.getStorageSync('reports') || [];
    reports.unshift(report);
    wx.setStorageSync('reports', reports);
    this.setData({
      divSystemLabel: systemLabels[rawData.divSystem] || '六爻起卦',
      report: {
        petName: rawData.petName || '我的宠物',
        petAvatar: '',
        time: rawData.time || new Date().toLocaleString(),
        divSystem: rawData.divSystem,
        question: rawData.question,
        reportId: rawData.reportId,
        coreAnswer: rawData.coreAnswer || '',
        coreBasis: rawData.coreBasis || '',
        foodSatisfaction: rawData.foodSatisfaction || '★★★☆☆',
        moodLevel: rawData.moodLevel || '★★★☆☆',
        bodyStatus: rawData.bodyStatus || '基本正常',
        statusSummary: rawData.statusSummary || '',
        ownerView: rawData.ownerView || '',
        petMessage: rawData.petMessage || '',
        petWish: rawData.petWish || '',
        carePlan: rawData.carePlan || [],
        products: (rawData.products || []).map(p => ({
          id: p.id,
          name: p.name,
          price: p.price || '',
          image: p.image || '/images/product-default.png'
        }))
      }
    })
  },

  async toggleFavorite() {
    const { reportId } = this.data.report
    if (!reportId) return

    try {
      await API.Favorite.toggle(reportId, 'emotion')
      this.setData({ favorited: !this.data.favorited })
      wx.showToast({
        title: this.data.favorited ? '已收藏' : '已取消收藏',
        icon: 'none'
      })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  downloadReport() {
    wx.showToast({ title: '报告已保存到相册', icon: 'success' })
  },

  shareReport() {
    wx.showShareMenu({ withShareTicket: true })
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id
    if (id > 0) {
      wx.navigateTo({ url: `/pages/shop/detail/detail?id=${id}` })
    }
  },

  goShop() {
    wx.switchTab({ url: '/pages/shop/shop' })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.report.petName}的心声解读报告`,
      path: '/pages/emotion/report/report'
    }
  }
})
