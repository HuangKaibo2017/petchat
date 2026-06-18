Component({
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: false }
  },
  data: {
    statusBarHeight: 0,
    navHeight: 0
  },
  lifetimes: {
    attached() {
      const { statusBarHeight, platform } = wx.getSystemInfoSync()
      const isIOS = platform === 'ios'
      this.setData({
        statusBarHeight,
        navHeight: statusBarHeight + (isIOS ? 44 : 48)
      })
    }
  },
  methods: {
    onBack() {
      wx.navigateBack({ delta: 1 })
    }
  }
})
