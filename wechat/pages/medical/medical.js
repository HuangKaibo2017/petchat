Page({
  data: { type: '', symptom: '', generating: false },
  onLoad(options) { if (options.type) this.setData({ type: options.type }) },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  chooseImage() {
    wx.chooseImage({ count: 1, sizeType: ['compressed'], success: (res) => {} })
  },
  generateGuide() {
    this.setData({ generating: true })
    setTimeout(() => {
      this.setData({ generating: false })
      wx.navigateTo({ url: '/pages/medical/detail/detail' })
    }, 2000)
  }
})
