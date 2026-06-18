const { mockPets, mockUser } = require('./utils/mock')

App({
  globalData: {
    userInfo: null,
    isAuthorized: false,
    currentPet: null,
    pets: [],
    favorites: [],
    cart: [],
    nfcEnabled: true,
    baseUrl: 'http://localhost:8001',
    debug: true
  },

  onLaunch() {
    // 本地调试：首次启动自动注入演示数据
    this.initDemoData()
    this.loadUserData()
    this.checkUpdate()
  },

  onShow(options) {
    if (options.query && options.query.scene) {
      this.handleScene(options.query.scene)
    }
  },

  // 首次启动自动注入演示数据
  initDemoData() {
    const hasRun = wx.getStorageSync('_demo_initialized')
    if (hasRun) return

    console.log('[Gengdongta] 首次启动，注入演示数据…')
    wx.setStorageSync('token', 'demo_token_local')
    wx.setStorageSync('userInfo', mockUser)
    wx.setStorageSync('pets', mockPets)
    wx.setStorageSync('currentPetId', mockPets[0].id)
    wx.setStorageSync('ownerBirthday', mockUser.birthday)
    wx.setStorageSync('_demo_initialized', true)
  },

  loadUserData() {
    const userInfo = wx.getStorageSync('userInfo')
    const pets = wx.getStorageSync('pets') || []
    const currentPetId = wx.getStorageSync('currentPetId')

    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.isAuthorized = true
    }
    if (pets.length > 0) {
      this.globalData.pets = pets
      this.globalData.currentPet = currentPetId
        ? pets.find(p => p.id === currentPetId) || pets[0]
        : pets[0]
    }
  },

  handleScene(scene) {
    if (scene && scene.startsWith('nfc_')) {
      const petId = scene.replace('nfc_', '')
      wx.navigateTo({ url: `/pages/index/index?nfcPetId=${petId}` })
    }
  },

  checkUpdate() {
    if (wx.getUpdateManager) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate(res => {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(() => {
            wx.showModal({
              title: '更新提示',
              content: '新版本已就绪，是否重启应用？',
              success: r => { if (r.confirm) updateManager.applyUpdate() }
            })
          })
        }
      })
    }
  },

  requestAuth(callback) {
    wx.getUserProfile({
      desc: '用于完善宠物档案信息',
      success: (res) => {
        this.globalData.userInfo = res.userInfo
        this.globalData.isAuthorized = true
        wx.setStorageSync('userInfo', res.userInfo)
        if (callback) callback(res)
      },
      fail: () => {
        wx.showToast({ title: '授权后可体验完整功能', icon: 'none' })
      }
    })
  },

  switchPet(petId) {
    const pet = this.globalData.pets.find(p => p.id === petId)
    if (pet) {
      this.globalData.currentPet = pet
      wx.setStorageSync('currentPetId', petId)
    }
  }
})
