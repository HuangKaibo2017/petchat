const app = getApp()

Page({
  data: {
    nfcSupported: false,
    nfcActive: false,
    autoGoTimer: null
  },

  onLoad() {
    this.setData({ nfcSupported: app.globalData.nfcEnabled })

    // NFC 触发：快速进入
    if (app.globalData.nfcTriggered) {
      this.setData({ nfcActive: true })
      this.data.autoGoTimer = setTimeout(() => {
        this.goHomeNFC()
      }, 1500)
      return
    }

    // 正常：4 秒自动跳转
    this.data.autoGoTimer = setTimeout(() => {
      this.goHome()
    }, 4000)
  },

  onUnload() {
    if (this.data.autoGoTimer) {
      clearTimeout(this.data.autoGoTimer)
    }
  },

  goHome() {
    this.clearTimer()
    wx.setStorageSync('_welcome_shown', true)
    wx.switchTab({ url: '/pages/index/index' })
  },

  goHomeNFC() {
    this.clearTimer()
    wx.setStorageSync('_welcome_shown', true)
    app.globalData._nfcWelcome = true
    wx.switchTab({ url: '/pages/index/index' })
  },

  goHomeGuest() {
    this.clearTimer()
    wx.setStorageSync('_welcome_shown', true)
    app.globalData.isGuest = true
    wx.switchTab({ url: '/pages/index/index' })
  },

  clearTimer() {
    if (this.data.autoGoTimer) {
      clearTimeout(this.data.autoGoTimer)
      this.data.autoGoTimer = null
    }
  }
})
