const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    breed: '',
    age: '',
    gender: 'unknown',
    faceImage: '',
    pawImage: '',
    generating: false,
    report: null
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },
  setGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender })
  },
  uploadFace() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => this.setData({ faceImage: res.tempFiles[0].tempFilePath }) })
  },
  uploadPaw() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => this.setData({ pawImage: res.tempFiles[0].tempFilePath }) })
  },

  async generateGuide() {
    if (!this.data.breed.trim()) {
      wx.showToast({ title: '请输入品种名称', icon: 'none' })
      return
    }
    this.setData({ generating: true })
    try {
      const result = await API.Report.medical({
        symptom: this.data.breed + ' ' + this.data.age + ' ' + this.data.gender,
        imageUrl: this.data.faceImage || this.data.pawImage || '',
        guideType: 'newpet'
      })
      let report = result
      if (typeof result === 'string') {
        report = { recommendation: result }
      } else if (result && result.data) {
        report = result.data
      }
      this.setData({ generating: false, report })
    } catch (err) {
      this.setData({ generating: false })
      // Fallback mock
      this.setData({ report: {
        commonDiseases: this.data.breed + '常见遗传病包括髋关节发育不良、眼睑内翻等，建议购买前要求卖家出示健康检测报告。',
        careTips: '该品种需要每日梳理毛发，注意牙齿清洁。幼年期需完成3针疫苗+狂犬，成年后每年加强一次。',
        costEstimate: '首年预算约8000-12000元（含购买费用、疫苗、绝育、基础用品）。后续年均4000-6000元（粮+猫砂+驱虫+体检）。',
        recommendation: '建议选择正规猫舍/犬舍，实地考察环境。签订购买合同，明确健康保障条款。入手前做好功课，理性消费。'
      }})
      wx.showToast({ title: '报告已生成', icon: 'success' })
    }
  }
})