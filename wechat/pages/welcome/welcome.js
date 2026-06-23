const app = getApp()

Page({
  data: {
    nfcSupported: false,
    nfcActive: false,
    loggingIn: false
  },

  onLoad() {
    this.setData({ nfcSupported: app.globalData.nfcEnabled })

    // NFC 触发：快速进入
    if (app.globalData.nfcTriggered) {
      this.setData({ nfcActive: true })
      setTimeout(() => {
        this.goHomeNFC()
      }, 1500)
      return
    }

    // 已有 token，直接跳首页
    const token = wx.getStorageSync('token')
    if (token) {
      this.goHome()
    }
  },

  // 微信一键登录
  async handleWechatLogin() {
    if (this.data.loggingIn) return
    this.setData({ loggingIn: true })

    wx.showLoading({ title: '登录中...', mask: true })

    try {
      const token = await app.wxLogin()
      wx.hideLoading()

      if (token) {
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 })
        // 刷新真实宠物数据
        app.refreshPets().finally(() => {})
        setTimeout(() => this.goHome(), 1000)
      } else {
        this.setData({ loggingIn: false })
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ loggingIn: false })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goHomeNFC() {
    app.globalData._nfcWelcome = true
    wx.switchTab({ url: '/pages/index/index' })
  },

  goHomeGuest() {
    app.globalData.isGuest = true
    wx.switchTab({ url: '/pages/index/index' })
  }
})
