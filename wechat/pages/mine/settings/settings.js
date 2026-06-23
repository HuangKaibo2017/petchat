const util = require('../../../utils/util')

Page({
  data: { voiceEnabled: true, nfcEnabled: true, cacheSize: '计算中...' },

  onShow() {
    this.updateCacheSize()
  },

  updateCacheSize() {
    const usage = util.checkStorageUsage()
    if (usage) {
      this.setData({ cacheSize: `${usage.usedMB}MB / ${usage.limitMB}MB` })
    } else {
      this.setData({ cacheSize: '未知' })
    }
  },

  toggleVoice(e) { this.setData({ voiceEnabled: e.detail.value }) },
  toggleNfc(e) { this.setData({ nfcEnabled: e.detail.value }) },

  clearCache() {
    const usage = util.checkStorageUsage()
    const msg = usage
      ? `当前使用 ${usage.usedMB}MB，清除后将释放空间。确认清除？`
      : '将清除本地缓存数据，确认？'

    wx.showModal({
      title: '清除缓存',
      content: msg,
      success: (res) => {
        if (res.confirm) {
          wx.clearStorage()
          this.setData({ cacheSize: '0MB / 10MB' })
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  openDoc(e) { var t=e.currentTarget.dataset.type; wx.navigateTo({ url: "/pages/mine/agreement/agreement?type="+t })
    const type = e.currentTarget.dataset.type
    const titles = { privacy: '隐私政策', agreement: '用户协议', disclaimer: '免责声明' }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新授权，本地数据将被清除',
      success: (res) => {
        if (res.confirm) {
          const app = getApp()
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('_wx_code')
          wx.removeStorageSync('pets')
          wx.removeStorageSync('currentPetId')
          wx.removeStorageSync('ownerBirthday')
          wx.removeStorageSync('reports')
          wx.removeStorageSync('healthReports')
          wx.removeStorageSync('favorites')
          wx.removeStorageSync('cart')
          wx.removeStorageSync('chatHistory')
          wx.removeStorageSync('_demo_initialized')
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
          app.globalData.pets = []
          app.globalData.currentPet = null
          app.globalData.favorites = []
          app.globalData.cart = []
          wx.reLaunch({ url: '/pages/index/index' })
        }
      }
    })
  }
})
