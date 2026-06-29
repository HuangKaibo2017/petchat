const app = getApp()

Page({
  data: {
    currentPet: {},
    showPetDropdown: false,
    photoList: [],
    pets: [],
    // 主人信息
    owner: {
      age: '',
      occupation: '',
      city: '',
      phone: '',
      diet: '',
      experience: ''
    },
    // 环境交互
    nfcCount: 0,
    deviceCount: 0,
    hardwareList: [],
    activeHardwareCount: 0
  },

  onLoad() {
    this.loadPets()
    this.loadDefaultPet()
    this.loadOwnerProfile()
    this.loadDeviceCounts()
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

  loadOwnerProfile() {
    const profile = wx.getStorageSync('ownerProfile') || {}
    this.setData({
      owner: {
        age: profile.age || '',
        occupation: profile.occupation || '',
        city: profile.city || '',
        phone: profile.phone || '',
        diet: profile.diet || '',
        experience: profile.experience || ''
      }
    })
  },

  loadDeviceCounts() {
    const nfcList = wx.getStorageSync('nfcList') || []
    const deviceList = wx.getStorageSync('deviceList') || []
    const hwList = [
      { id: 1, name: '智能项圈', active: deviceList.some(d => d.type === 'collar') },
      { id: 2, name: 'NFC贴',    active: nfcList.length > 0 },
      { id: 3, name: '语音盒',   active: deviceList.some(d => d.type === 'voicebox') }
    ]
    this.setData({
      nfcCount: nfcList.length,
      deviceCount: deviceList.length,
      hardwareList: hwList,
      activeHardwareCount: hwList.filter(h => h.active).length
    })
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
      wx.navigateTo({ url: '/pages/risk/report/report' })
    }, 1500)
  }
})
