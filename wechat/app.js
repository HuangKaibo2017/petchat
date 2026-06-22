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
    isGuest: false,
    // 本地开发: Express 后端 http://localhost:8001
    // 线上部署: https://petchat.life
    baseUrl: 'http://localhost:8003',
    debug: false
  },

  onLaunch() {
    this.initDemoData()
    this.loadUserData()
    this.checkUpdate()
  },

  onShow(options) {
    // 非首次启动：跳过欢迎页，直接到首页
    const welcomeShown = wx.getStorageSync('_welcome_shown')
    if (welcomeShown && getCurrentPages().length === 1) {
      const currentPage = getCurrentPages()[0]
      if (currentPage && currentPage.route === 'pages/welcome/welcome') {
        wx.switchTab({ url: '/pages/index/index' })
        return
      }
    }
    if (options.query && options.query.scene) {
      this.handleScene(options.query.scene)
    }
  },

  initDemoData() {
    const hasRun = wx.getStorageSync('_demo_initialized')
    if (hasRun) return

    console.log('[更懂它] 首次启动，注入演示数据…')
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
    }
    if (pets.length > 0) {
      this.globalData.pets = pets
      this.globalData.currentPet = currentPetId
        ? pets.find(p => p.id === currentPetId) || pets[0]
        : pets[0]
    }

    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.isAuthorized = true
    }
  },

  handleScene(scene) {
    // 标记已通过欢迎页
    wx.setStorageSync('_welcome_shown', true)
    if (scene && scene.startsWith('nfc_')) {
      const petId = scene.replace('nfc_', '')
      this.globalData.nfcTriggered = true
      this.globalData.nfcPetId = petId
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
    if (!wx.getUserProfile) {
      console.warn('[更懂它] getUserProfile 不可用，请使用 authorize 组件')
      wx.showToast({ title: '授权后可体验完整功能', icon: 'none' })
      return
    }
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

  loginWithCode(callback) {
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.setStorageSync('_wx_code', res.code)
          this.globalData.isAuthorized = true
          if (callback) callback({ code: res.code })
        } else {
          wx.showToast({ title: '登录失败，请重试', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '授权后可体验完整功能', icon: 'none' })
      }
    })
  },

  async refreshPets() {
    try {
      const API = require('./utils/api')
      const pets = await API.Pet.list()
      if (pets && pets.length > 0) {
        this.globalData.pets = pets
        wx.setStorageSync('pets', pets)
        const currentId = wx.getStorageSync('currentPetId')
        const stillExists = pets.find(p => p.id === currentId)
        if (!stillExists && pets.length > 0) {
          this.globalData.currentPet = pets[0]
          wx.setStorageSync('currentPetId', pets[0].id)
        }
        console.log('[更懂它] 宠物列表已刷新:', pets.length, '只')
      }
    } catch (err) {
      console.warn('[更懂它] 刷新宠物列表失败:', err.message)
    }
  },

  switchPet(petId) {
    const pet = this.globalData.pets.find(p => p.id === petId)
    if (pet) {
      this.globalData.currentPet = pet
      wx.setStorageSync('currentPetId', petId)
    }
  }
})
