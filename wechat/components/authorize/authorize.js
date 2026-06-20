Component({
  properties: {
    visible: { type: Boolean, value: false }
  },
  methods: {
    // 新版 getUserInfo 按钮回调（替代已废弃的 getUserProfile）
    onGetUserInfo(e) {
      if (!e.detail || !e.detail.userInfo) {
        wx.showToast({ title: '需要授权后才能使用完整功能', icon: 'none' })
        return
      }
      const app = getApp()
      const userInfo = e.detail.userInfo
      app.globalData.userInfo = userInfo
      app.globalData.isAuthorized = true
      wx.setStorageSync('userInfo', userInfo)
      this.triggerEvent('success', userInfo)
    },
    // 降级：旧版 getUserProfile（基础库 < 2.27.1）
    onAuth() {
      const app = getApp()
      app.requestAuth((res) => {
        this.triggerEvent('success', res)
      })
    },
    onCancel() {
      this.triggerEvent('cancel')
    },
    onMaskTap() {},
    noop() {}
  }
})
