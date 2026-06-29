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
  goEmotion()    { this.checkAuth(() => wx.navigateTo({ url: '/pages/emotion/emotion' })) },

  goHealth()     { this.checkAuth(() => wx.navigateTo({ url: '/pages/health/health' })) },

  goRisk()      { this.checkAuth(() => wx.navigateTo({ url: '/pages/risk/risk' })) },

  goRegister()   { this.checkAuth(() => wx.navigateTo({ url: '/pages/mine/register/register' })) },

  onShareAppMessage() {
    return { title: '更懂它 - 更懂它的心，陪它一生长久', path: '/pages/index/index' }
  }
})
