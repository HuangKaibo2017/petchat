const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    step: 0,
    pets: [],
    selectedPet: null,
    symptom: '',
    symptomImage: '',
    duration: '',
    abnormal: '',
    numbers: ['', '', '', '', '', ''],
    canSubmit: false,
    generating: false
  },

  onLoad() { this.loadPets() },
  onShow() { this.loadPets() },

  loadPets() {
    this.setData({ pets: app.globalData.pets || wx.getStorageSync('pets') || [] })
  },

  onSelectPet(e) { this.setData({ selectedPet: e.detail.pet }) },

  nextStep() {
    if (!this.data.selectedPet) return wx.showToast({ title: '请先选择宠物', icon: 'none' })
    this.setData({ step: 1 })
  },

  onSymptomInput(e) { this.setData({ symptom: e.detail.value }); this.checkCanSubmit() },
  onAbnormalInput(e) { this.setData({ abnormal: e.detail.value }) },

  chooseImage() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'],
      success: (res) => { this.setData({ symptomImage: res.tempFilePaths[0] }) }
    })
  },

  selectDuration(e) { this.setData({ duration: e.currentTarget.dataset.dur }); this.checkCanSubmit() },

  onNumberInput(e) {
    const index = e.currentTarget.dataset.index
    const numbers = [...this.data.numbers]
    numbers[index] = e.detail.value.slice(-1)
    this.setData({ numbers })
    this.checkCanSubmit()
  },

  checkCanSubmit() {
    const { symptom, duration, numbers } = this.data
    this.setData({
      canSubmit: !!symptom.trim() && !!duration && numbers.every(n => n !== '')
    })
  },

  async generateReport() {
    if (!app.globalData.isAuthorized) {
      app.requestAuth(() => this.generateReport())
      return
    }

    this.setData({ generating: true })
    const { selectedPet, symptom, duration, abnormal, numbers, symptomImage } = this.data

    try {
      let imageUrl = ''
      if (symptomImage) {
        try {
          const uploadResult = await API.Upload.upload(symptomImage, 'report', selectedPet.id)
          imageUrl = uploadResult.publicUrl
        } catch (e) { console.warn('Image upload failed:', e) }
      }

      const result = await API.Report.health({
        petId: selectedPet.id,
        symptom,
        duration,
        abnormal,
        numbers: numbers.filter(n => n),
        imageUrl,
      })

      this.setData({ generating: false })
      wx.navigateTo({
        url: `/pages/health/report/report?data=${encodeURIComponent(JSON.stringify(result))}`
      })
    } catch (err) {
      this.setData({ generating: false })
      if (err.message === 'QUOTA_EXCEEDED') {
        wx.showModal({ title: '次数已用完', content: '今日健康监测次数已用完', showCancel: false })
      } else {
        wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      }
    }
  }
})
