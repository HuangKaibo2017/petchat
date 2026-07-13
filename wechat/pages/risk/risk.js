const app = getApp()

Page({
  data: {
    currentPet: {},
    showPetDropdown: false,
    ownerBirthday: '',
    pets: [],
    submitting: false,
    photoList: [],
  },

  onLoad() {
    this.loadPets()
    this.loadDefaultPet()
    const userInfo = wx.getStorageSync('userInfo') || {}
    if (userInfo.birthday) {
      this.setData({ ownerBirthday: userInfo.birthday })
    }
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
    const idx = e.currentTarget.dataset.index
    const list = [...this.data.photoList]
    list.splice(idx, 1)
    this.setData({ photoList: list })
  },

  onBirthdayInput(e) {
    this.setData({ ownerBirthday: e.detail.value })
  },

  async generateReport() {
    if (!this.data.currentPet.id) {
      wx.showToast({ title: '请先选择宠物', icon: 'none' })
      return
    }

    const API = require('../../utils/api')
    this.setData({ submitting: true })
    wx.showLoading({ title: '评估中...' })

    try {
      const result = await API.Report.risk({
        petId: this.data.currentPet.id,
        ownerBirthday: this.data.ownerBirthday,
      })

      wx.hideLoading()
      app.globalData._lastRiskReport = result
      wx.navigateTo({ url: '/pages/risk/report/report' })
    } catch (err) {
      wx.hideLoading()
      console.error('[risk] generate error:', err)
      wx.navigateTo({ url: '/pages/risk/report/report' })
    }

    this.setData({ submitting: false })
  }
})
