const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    favorites: [],
    loading: false,
  },

  onShow() {
    this.loadFavorites()
  },

  async loadFavorites() {
    if (!app.globalData.isAuthorized) {
      this.setData({ favorites: wx.getStorageSync('favorites') || [] })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await API.Favorite.list()
      if (res && res.length > 0) {
        this.setData({ favorites: res })
      }
    } catch (e) {
      console.warn('Failed to load favorites:', e)
      this.setData({ favorites: wx.getStorageSync('favorites') || [] })
    }
    this.setData({ loading: false })
  },

  goDetail(e) {
    const report = e.detail?.report || e.currentTarget?.dataset
    const pageMap = { emotion: 'emotion', health: 'health', risk: 'risk' }
    const page = pageMap[report.type] || 'emotion'
    wx.navigateTo({ url: `/pages/${page}/report/report?id=${report.id}` })
  },
})
