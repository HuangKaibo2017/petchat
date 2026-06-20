Page({
  data: { content: '', image: '' },
  onInput(e) { this.setData({ content: e.detail.value }) },
  chooseImage() {
    wx.chooseImage({ count: 1, sizeType: ['compressed'], success: (res) => { this.setData({ image: res.tempFilePaths[0] }) } })
  },
  publish() {
    if (!this.data.content.trim()) return wx.showToast({ title: '请输入内容', icon: 'none' })
    wx.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  }
})
