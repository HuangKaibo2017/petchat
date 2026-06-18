Page({
  data: { voiceEnabled: true, nfcEnabled: true, cacheSize: '12.5MB' },
  toggleVoice(e) { this.setData({ voiceEnabled: e.detail.value }) },
  toggleNfc(e) { this.setData({ nfcEnabled: e.detail.value }) },
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除本地缓存数据',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorage()
          this.setData({ cacheSize: '0MB' })
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },
  openDoc(e) {
    const type = e.currentTarget.dataset.type
    wx.showToast({ title: `查看${type === 'privacy' ? '隐私政策' : type === 'agreement' ? '用户协议' : '免责声明'}`, icon: 'none' })
  },
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新授权',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          const app = getApp()
          app.globalData.isAuthorized = false
          app.globalData.userInfo = null
          wx.reLaunch({ url: '/pages/index/index' })
        }
      }
    })
  }
})
