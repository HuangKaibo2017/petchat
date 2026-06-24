const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    pets: [],
    selectedPet: null,
    petIndex: 0,
    petNames: [],
    generating: false,
  },

  onLoad() { this.loadPets() },
  onShow() { this.loadPets() },

  loadPets() {
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    this.setData({
      pets,
      petNames: pets.map(p => p.name),
      petIndex: 0,
      selectedPet: pets.length > 0 ? pets[0] : null,
    })
  },

  onPetChange(e) {
    const idx = parseInt(e.detail.value)
    const pet = this.data.pets[idx]
    this.setData({ petIndex: idx, selectedPet: pet })
  },

  async generateReport() {
    const { selectedPet } = this.data
    if (!selectedPet) return wx.showToast({ title: '请先选择宠物', icon: 'none' })

    this.setData({ generating: true })

    try {
      const ownerBirthday = wx.getStorageSync('ownerBirthday') || ''
      if (!ownerBirthday) {
        wx.showToast({ title: '请先在「我的」页面完善主人档案', icon: 'none' })
        this.setData({ generating: false })
        return
      }
      const result = await API.Report.risk({ petId: selectedPet.id, ownerBirthday })
      this.setData({ generating: false })
      wx.navigateTo({
        url: `/pages/risk/report/report?data=${encodeURIComponent(JSON.stringify({
          report: result.report || result,
          pet: selectedPet,
        }))}`
      })
    } catch (err) {
      this.setData({ generating: false })
      wx.showToast({ title: err.message || '生成失败', icon: 'none' })
    }
  },
})
