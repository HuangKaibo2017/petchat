const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    step: 0,
    pets: [],
    selectedPet: null,
    healthReports: [],
    selectedReport: null,
    ownerBirthday: '',
    tongueImage: '',
    canGenerate: false,
    generating: false
  },

  onLoad() {
    this.loadPets()
    this.loadHealthReports()
    const birthday = wx.getStorageSync('ownerBirthday') || ''
    if (birthday) this.setData({ ownerBirthday: birthday })
  },

  loadPets() {
    this.setData({ pets: app.globalData.pets || wx.getStorageSync('pets') || [] })
  },

  async loadHealthReports() {
    try {
      const reports = await API.Report.history('health')
      if (reports && reports.length > 0) {
        this.setData({
          healthReports: reports.map(r => ({
            id: r.f_id,
            petId: r.f_pet_id,
            level: r.f_health_level,
            score: r.f_health_score,
            createdAt: r.f_created_at,
            summary: r.f_meta_info?.currentSymptoms || r.f_health_level || '',
          }))
        })
      }
    } catch (e) {
      // Fall back to local data
      const reports = wx.getStorageSync('healthReports') || []
      this.setData({ healthReports: reports })
    }
  },

  onSelectPet(e) { this.setData({ selectedPet: e.detail.pet }) },
  nextStep() {
    if (!this.data.selectedPet) return wx.showToast({ title: '请先选择宠物', icon: 'none' })
    this.setData({ step: 1 })
  },

  selectReport(e) {
    const id = e.currentTarget.dataset.id
    const report = this.data.healthReports.find(r => r.id === id)
    this.setData({ selectedReport: report })
    this.checkCanGenerate()
  },

  onBirthdayChange(e) {
    this.setData({ ownerBirthday: e.detail.value })
    wx.setStorageSync('ownerBirthday', e.detail.value)
    this.checkCanGenerate()
  },

  chooseTongueImage() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'],
      success: (res) => { this.setData({ tongueImage: res.tempFilePaths[0] }) }
    })
  },

  checkCanGenerate() {
    this.setData({ canGenerate: !!this.data.selectedReport && !!this.data.ownerBirthday })
  },

  async generateReport() {
    if (!app.globalData.isAuthorized) {
      app.requestAuth(() => this.generateReport())
      return
    }

    this.setData({ generating: true })
    const { selectedPet, selectedReport, ownerBirthday, tongueImage } = this.data

    try {
      let tongueUrl = ''
      if (tongueImage) {
        try {
          const uploadResult = await API.Upload.upload(tongueImage, 'report', selectedPet.id)
          tongueUrl = uploadResult.publicUrl
        } catch (e) { console.warn('Image upload failed:', e) }
      }

      const result = await API.Report.risk({
        petId: selectedPet.id,
        reportId: selectedReport?.id,
        ownerBirthday,
        tongueImage: tongueUrl,
      })

      this.setData({ generating: false })
      wx.navigateTo({
        url: `/pages/risk/report/report?data=${encodeURIComponent(JSON.stringify(result))}`
      })
    } catch (err) {
      this.setData({ generating: false })
      if (err.message === 'QUOTA_EXCEEDED') {
        wx.showModal({ title: '次数已用完', content: '今日风险评估次数已用完', showCancel: false })
      } else {
        wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      }
    }
  }
})
