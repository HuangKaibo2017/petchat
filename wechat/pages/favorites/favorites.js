const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    favorites: [],
    loading: false
  },

  onShow() {
    this.loadFavorites()
  },

  async loadFavorites() {
    this.setData({ loading: true })
    try {
      const result = await API.Favorite.list()
      const favorites = Array.isArray(result) ? result : (result?.favorites || [])
      this.setData({ favorites })
    } catch (e) {
      console.warn('加载收藏失败，使用本地:', e)
      const localFavs = wx.getStorageSync('favorites') || []
      this.setData({ favorites: localFavs })
    }
    this.setData({ loading: false })
  },

  async removeFavorite(e) {
    const id = e.currentTarget.dataset.id
    try {
      await API.Favorite.toggle(id, '')
      // 本地移除
      const favorites = this.data.favorites.filter(f => f.id !== id)
      this.setData({ favorites })
      wx.setStorageSync('favorites', favorites)
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  goReport(e) {
    const { id, type } = e.currentTarget.dataset
    const pages = {
      emotion: '/pages/emotion/report/report',
      health: '/pages/health/report/report',
      risk: '/pages/risk/report/report'
    }
    const url = pages[type] || pages.emotion
    wx.navigateTo({ url: `${url}?id=${id}` })
  }
})
