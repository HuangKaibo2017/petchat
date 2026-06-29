const app = getApp()

Page({
  data: {
    currentPet: {},
    showPetDropdown: false,
    descText: '',
    symptomText: '',
    dietText: '',
    exerciseText: '',
    photoList: [],
    pets: [],
    // 健康相关参数
    weight: '',
    temperature: '',
    heartRate: '',
    sleepHours: '',
    waterIntake: ''
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

  // ─── 宠物选择 ───
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

  // ─── 输入处理 ───
  onDescInput(e) {
    this.setData({ descText: e.detail.value })
  },

  onSymptomInput(e) {
    this.setData({ symptomText: e.detail.value })
  },

  onDietInput(e) {
    this.setData({ dietText: e.detail.value })
  },

  onExerciseInput(e) {
    this.setData({ exerciseText: e.detail.value })
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  // ─── 上传照片 ───
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

  // ─── 生成报告 ───
  generateReport() {
    if (!this.data.currentPet.id) {
      wx.showToast({ title: '请先选择宠物', icon: 'none' })
      return
    }
    wx.showLoading({ title: '分析中...' })
    setTimeout(() => {
      wx.hideLoading()
      wx.navigateTo({ url: '/pages/health/report/report' })
    }, 1500)
  }
})
