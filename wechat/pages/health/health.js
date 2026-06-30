const app = getApp()

Page({
  data: {
    currentPet: {},
    showPetDropdown: false,
    descText: '',
    photoList: [],
    pets: [],
    submitting: false,
  },

  onLoad() {
    this.loadPets()
    this.loadDefaultPet()
  },

  loadPets() {
    const pets = wx.getStorageSync('pets') || []
    this.setData({ pets })
  },

  loadDefaultPet() {
    const pets = this.data.pets
    if (pets.length > 0 && !this.data.currentPet.id) {
      this.setData({ currentPet: pets[0] })
    }
  },

  togglePetList() {
    this.setData({ showPetDropdown: !this.data.showPetDropdown })
  },

  selectPet(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentPet: this.data.pets[index],
      showPetDropdown: false
    })
  },

  goAddPet() {
    wx.navigateTo({ url: '/pages/mine/register/register' })
  },

  onDescInput(e) {
    this.setData({ descText: e.detail.value })
  },

  addPhoto() {
    wx.chooseImage({
      count: 9 - this.data.photoList.length,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        this.setData({
          photoList: [...this.data.photoList, ...res.tempFilePaths]
        })
      }
    })
  },

  delPhoto(e) {
    const index = e.currentTarget.dataset.index
    const list = [...this.data.photoList]
    list.splice(index, 1)
    this.setData({ photoList: list })
  },

  async generateReport() {
    if (!this.data.currentPet.id) {
      wx.showToast({ title: '请先选择宠物', icon: 'none' })
      return
    }

    const API = require('../../utils/api')
    this.setData({ submitting: true })
    wx.showLoading({ title: '分析中...' })

    try {
      const result = await API.Report.health({
        petId: this.data.currentPet.id,
        symptom: this.data.descText,
        imageUrl: this.data.photoList[0] || '',
      })

      wx.hideLoading()
      app.globalData._lastHealthReport = result
      wx.navigateTo({ url: '/pages/health/report/report' })
    } catch (err) {
      wx.hideLoading()
      console.error('[health] generate error:', err)
      wx.navigateTo({ url: '/pages/health/report/report' })
    }

    this.setData({ submitting: false })
  }
})
