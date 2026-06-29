const app = getApp()

Page({
  data: {
    currentPet: null,
    pets: [],
    currentMood: 'happy',
    moodIcon: '😊',
    moodLabel: '开心',
    nfcEnabled: true,
    showAuth: false,
    loading: true,
    statusBarHeight: 44,
    capsuleRight: 180
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: sys.statusBarHeight || 44,
      capsuleRight: sys.windowWidth - menu.left + 16
    })
    this.loadPetData()
    if (options.nfcPetId) {
      this.handleNfcScan(options.nfcPetId)
    }
  },

  onShow() {
    if (app.globalData._nfcWelcome) {
      app.globalData._nfcWelcome = false
      const pet = app.globalData.currentPet
      if (pet) {
        wx.showToast({ title: 'NFC识别成功！欢迎' + pet.name, icon: 'none', duration: 2000 })
      }
    }
    this.loadPetData()
  },

  loadPetData() {
    this.setData({ loading: true })
    const { MockAPI } = require('../../utils/mock')
    MockAPI.getPets().then(res => {
      const pets = (res && res.data) ? res.data : []
      const currentPet = pets.length > 0 ? pets[0] : null
      // 根据 Figma Lo-fi 首页设计，随机 mock 情绪状态
      const moodMap = this.getRandomMood()
      this.setData({
        pets,
        currentPet,
        currentMood: moodMap.value,
        moodIcon: moodMap.icon,
        moodLabel: moodMap.label,
        loading: false
      })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  getRandomMood() {
    // Figma Lo-fi 首页展示 "Sad" 状态，以此为核心随机选择一个情绪
    const moods = [
      { value: 'happy', icon: '😊', label: '开心' },
      { value: 'sad', icon: '😢', label: '难过' },
      { value: 'calm', icon: '😌', label: '平静' },
      { value: 'excited', icon: '🤩', label: '兴奋' },
      { value: 'anxious', icon: '😰', label: '焦虑' },
      { value: 'tired', icon: '😴', label: '疲惫' },
      { value: 'angry', icon: '😤', label: '生气' },
      { value: 'scared', icon: '😨', label: '害怕' }
    ]
    // 模拟数据，默认展示 "难过" 以匹配 Figma 中 "Sad" 设计
    return moods[1]
  },

  handleNfcScan(petId) {
    const pets = this.data.pets
    const pet = pets.find(p => p.id === petId)
    if (pet) {
      this.setData({ currentPet: pet })
      wx.showToast({ title: 'NFC识别成功！欢迎' + pet.name, icon: 'none', duration: 2000 })
    }
  },

  checkAuth(callback) {
    if (app.globalData.isLoggedIn) {
      callback()
    } else {
      this.setData({ showAuth: true, _pendingAuth: callback })
    }
  },
  onAuthSuccess() {
    this.setData({ showAuth: false })
    const cb = this._pendingAuth
    if (cb) { this._pendingAuth = null; cb() }
  },

  // ─── 核心工具 ───
  goHealth()     { this.checkAuth(() => wx.navigateTo({ url: '/pages/health/health' })) },
  goEmotion()    { this.checkAuth(() => wx.navigateTo({ url: '/pages/emotion/overview/overview' })) },
  goPersonality(){ this.checkAuth(() => wx.navigateTo({ url: '/pages/personality/personality' })) },
  goRisk()       { this.checkAuth(() => wx.navigateTo({ url: '/pages/risk/risk' })) },
  goMedical()    { wx.navigateTo({ url: '/pages/health/health' }) },
  goNewPet()     { wx.navigateTo({ url: '/pages/newpet/newpet' }) },
  goLostPet()    { this.checkAuth(() => wx.navigateTo({ url: '/pages/lostpet/lostpet' })) },

  // ─── 救助 ───
  goRescue()     { wx.navigateTo({ url: '/pages/rescue/rescue' }) },
  goRescueHelp() { wx.navigateTo({ url: '/pages/rescue/rescue?tab=help' }) },
  goRescueAdopt(){ wx.navigateTo({ url: '/pages/rescue/rescue?tab=adopt' }) },

  // ─── 照片 ───
  goUploadPhoto() {
    const that = this
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFiles = res.tempFiles
        that.checkAuth(() => {
          app.globalData._uploadPhotos = tempFiles
          wx.navigateTo({ url: '/pages/photo/photo' })
        })
      }
    })
  },
  goPhoto()      { this.checkAuth(() => wx.navigateTo({ url: '/pages/photo/photo' })) },

  // ─── 医院 / 商城 ───
  goHospitals()  { wx.navigateTo({ url: '/pages/hospitals/hospitals' }) },
  goShop()       { wx.switchTab({ url: '/pages/shop/shop' }) },
  goRegister()   { this.checkAuth(() => wx.navigateTo({ url: '/pages/mine/register/register' })) },

  onShareAppMessage() {
    return { title: '更懂它 - 更懂它的心，陪它一生长久', path: '/pages/index/index' }
  }
})
