Page({
  applyAgent() {
    wx.showModal({
      title: '申请代理',
      content: '客服将尽快与您联系，确认代理资质',
      success: (res) => {
        if (res.confirm) wx.showToast({ title: '申请已提交', icon: 'success' })
      }
    })
  }
})
