const app = getApp()
const API = require('../../utils/api')
const util = require('../../utils/util')

// 五运六气信息
function getWuyunInfo() {
  const now = new Date()
  const month = now.getMonth() + 1
  const seasons = { 1:'初之气(厥阴风木)',2:'初之气',3:'二之气(少阴君火)',4:'二之气',5:'三之气(少阳相火)',6:'三之气',7:'四之气(太阴湿土)',8:'四之气',9:'五之气(阳明燥金)',10:'五之气',11:'终之气(太阳寒水)',12:'终之气' }
  return seasons[month] || '终之气'
}

Page({
  data: {
    step: 0,
    mode: '',
    pets: [],
    selectedPet: null,
    symptom: '',
    symptomImage: '',
    duration: '',
    abnormal: '',
    numbers: ['', '', '', '', '', ''],
    canSubmit: false,
    generating: false,
    currentTime: util.formatTime(new Date()),
    wuyunInfo: getWuyunInfo()
  },

  onLoad() { this.loadPets() },
  onShow() { this.loadPets() },

  loadPets() {
    this.setData({ pets: app.globalData.pets || wx.getStorageSync('pets') || [] })
  },

  onSelectPet(e) { this.setData({ selectedPet: e.detail.pet }) },

  selectMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode, step: 1 })
  },

  nextStep() {
    if (!this.data.selectedPet) return wx.showToast({ title: '请先选择宠物', icon: 'none' })
    this.setData({ step: 2 })
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

  // 整体分析
  async generateOverall() {
    if (!app.globalData.isLoggedIn) {
      app.wxLogin().then(token => { if (token) this.generateOverall() })
      return
    }

    this.setData({ generating: true })
    const { selectedPet } = this.data

    try {
      const result = await API.Report.health({
        petId: selectedPet.id,
        mode: 'overall',
        symptom: '',
        duration: '',
        abnormal: '',
        numbers: [],
        imageUrl: '',
      })

      // 季度提醒
      const reminderShown = wx.getStorageSync('_constitution_reminder')
      if (!reminderShown) {
        wx.setStorageSync('_constitution_reminder', true)
        wx.showModal({
          title: '温馨提示',
          content: '建议每个季度生成新的体质分析报告，追踪宠物体质变化趋势。',
          showCancel: false,
          confirmText: '知道了'
        })
      }

      this.setData({ generating: false })
      app.globalData._reportData = { ...result, mode: 'overall', wuyunInfo: this.data.wuyunInfo }
      wx.navigateTo({ url: '/pages/health/report/report' })
    } catch (err) {
      this.setData({ generating: false })
      wx.showToast({ title: err.message || '生成失败', icon: 'none' })
    }
  },

  // 具体分析
  async generateSpecific() {
    if (!app.globalData.isLoggedIn) {
      app.wxLogin().then(token => { if (token) this.generateSpecific() })
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
        mode: 'specific',
        symptom,
        duration,
        abnormal,
        numbers: numbers.filter(n => n),
        imageUrl,
      })

      this.setData({ generating: false })
      app.globalData._reportData = { ...result, mode: 'specific' }
      wx.navigateTo({ url: '/pages/health/report/report' })
    } catch (err) {
      this.setData({ generating: false })
      if (err.message === 'QUOTA_EXCEEDED') {
        wx.showModal({ title: '次数已用完', content: '今日体质分析次数已用完', showCancel: false })
      } else {
        wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      }
    }
  }
})
