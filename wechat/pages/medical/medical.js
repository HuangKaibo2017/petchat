const API = require('../../utils/api')

Page({
  data: { type: '', symptom: '', symptomImage: '', generating: false },

  onLoad(options) {
    if (options.type) this.setData({ type: options.type })
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  chooseImage() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'],
      success: (res) => { this.setData({ symptomImage: res.tempFilePaths[0] }) }
    })
  },

  async generateGuide() {
    const { symptom, symptomImage, type } = this.data
    if (!symptom.trim()) return

    this.setData({ generating: true })

    try {
      let imageUrl = ''
      if (symptomImage) {
        try {
          const uploadRes = await API.Upload.upload(symptomImage, 'symptom')
          imageUrl = uploadRes.publicUrl || uploadRes.filePath || symptomImage
        } catch (e) {
          console.warn('Image upload failed, proceeding without:', e)
        }
      }

      const result = await API.Report.medical({
        symptom,
        imageUrl,
        guideType: type === 'newpet' ? 'newpet' : 'medical',
      })

      this.setData({ generating: false })

      wx.navigateTo({
        url: `/pages/medical/detail/detail?data=${encodeURIComponent(JSON.stringify(result))}`
      })
    } catch (err) {
      this.setData({ generating: false })
      if (err.message === 'UNAUTHORIZED') {
        const app = getApp()
        app.requestAuth(() => this.generateGuide())
      } else {
        wx.showToast({ title: err.message || '生成失败，请重试', icon: 'none' })
      }
    }
  }
})
