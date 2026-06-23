const app = getApp()

Page({
  data: {
    currentPet: null,
    pets: [],
    nfcEnabled: true,
    showAuth: false,
    watermarkText: '',
    statusBarHeight: 44,
    capsuleRight: 180
  },

  onLoad(options) {
    // 获取系统信息适配安全区域
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
    const { MockAPI } = require('../../utils/mock')
    MockAPI.getPets().then(res => {
      const pets = (res && res.data) ? res.data : []
      this.setData({
        pets,
        currentPet: pets.length > 0 ? pets[0] : null
      })
    }).catch(() => {})
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

  // ─── 水印文字 ───
  onWatermarkInput(e) {
    this.setData({ watermarkText: e.detail.value })
  },

  // ─── 核心工具 ───
  goHealth() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/health/health' }))
  },
  goEmotion() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/emotion/emotion' }))
  },
  goPersonality() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/personality/personality' }))
  },
  goRisk() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/risk/risk' }))
  },
  goMedical() { wx.navigateTo({ url: '/pages/medical/medical' }) },
  goNewPet() { wx.navigateTo({ url: '/pages/newpet/newpet' }) },
  goLostPet() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/lostpet/lostpet' }))
  },

  // ─── 救助 ───
  goRescue() { wx.navigateTo({ url: '/pages/rescue/rescue' }) },
  goRescueHelp() { wx.navigateTo({ url: '/pages/rescue/rescue?tab=help' }) },
  goRescueAdopt() { wx.navigateTo({ url: '/pages/rescue/rescue?tab=adopt' }) },

  // ─── 照片 ───
  goPhoto() {
    this.checkAuth(() => {
      const text = this.data.watermarkText
      const url = text ? '/pages/photo/photo?text=' + encodeURIComponent(text) : '/pages/photo/photo'
      wx.navigateTo({ url })
    })
  },

  // ─── 医院 / 商城 ───
  goHospitals() { wx.navigateTo({ url: '/pages/hospitals/hospitals' }) },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) },
  goRegister() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/mine/register/register' }))
  },

  onShareAppMessage() {
    return { title: '更懂它 - 更懂它的心，陪它一生长久', path: '/pages/index/index' }
  }
})
