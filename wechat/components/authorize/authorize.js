Component({
  properties: {
    visible: { type: Boolean, value: false }
  },

  data: {
    avatarUrl: '',
    nickName: ''
  },

  methods: {
    // 选择头像
    onChooseAvatar(e) {
      const { avatarUrl } = e.detail
      this.setData({ avatarUrl })
    },

    // 昵称输入
    onNicknameInput(e) {
      this.setData({ nickName: e.detail.value })
    },

    // 确认提交
    onSubmit() {
      const { avatarUrl, nickName } = this.data
      if (!nickName.trim()) {
        wx.showToast({ title: '请输入昵称', icon: 'none' })
        return
      }

      const app = getApp()
      const userInfo = {
        nickName: nickName.trim(),
        avatarUrl: avatarUrl || ''
      }
      app.globalData.userInfo = userInfo
      app.globalData.isLoggedIn = true
      wx.setStorageSync('userInfo', userInfo)

      this.triggerEvent('success', userInfo)
    },

    // 跳过
    onSkip() {
      this.triggerEvent('cancel')
    },

    onMaskTap() {},
    noop() {}
  }
})
