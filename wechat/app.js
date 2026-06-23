const { mockPets, mockUser } = require('./utils/mock')

App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    currentPet: null,
    pets: [],
    favorites: [],
    cart: [],
    nfcEnabled: true,
    isGuest: false,
    // 线上: Supabase Edge Functions
    // 本地开发: Express 后端 http://localhost:8001
    baseUrl: 'https://gengdongta.com',
    debug: false
  },

  onLaunch() {
    this.initDemoData()
    this.loadUserData()
    this.checkUpdate()
    this.restoreLogin()
  },

  onShow(options) {
    const token = wx.getStorageSync('token')
    if (token && getCurrentPages().length === 1) {
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
      this.globalData.isLoggedIn = true
    }
  },

  handleScene(scene) {
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

  /**
   * 微信原生登录：wx.login 获取 code，换取后端 JWT。
   */
  wxLogin() {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          if (!res.code) {
            console.warn('[更懂它] wx.login 未返回 code')
            return resolve(null)
          }
          wx.request({
            url: `${this.globalData.baseUrl}/wechat-auth`,
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: { code: res.code },
            timeout: 30000,
            success: (r) => {
              const body = r.data || {}
              const data = body.data || body
              if (r.statusCode === 200 && data && data.token) {
                wx.setStorageSync('token', data.token)
                this.globalData.isLoggedIn = true
                if (data.user) {
                  const userInfo = {
                    nickName: data.user.nickname || data.user.name || '微信用户',
                    avatarUrl: data.user.avatarUrl || data.user.avatar || ''
                  }
                  this.globalData.userInfo = userInfo
                  wx.setStorageSync('userInfo', userInfo)
                }
                console.log('[更懂它] 微信登录成功')
                resolve(data.token)
              } else {
                console.warn('[更懂它] 登录失败:', body.message || r.statusCode)
                resolve(null)
              }
            },
            fail: (err) => {
              console.warn('[更懂它] 登录请求失败:', err.errMsg)
              resolve(null)
            }
          })
        },
        fail: () => {
          resolve(null)
        }
      })
    })
  },

  /**
   * 静默恢复已有登录态。
   */
  restoreLogin() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.isLoggedIn = true
    }
  },

  /**
   * 接口调用前确保已有有效 token，没有则触发登录。
   */
  async ensureLogin() {
    const token = wx.getStorageSync('token')
    if (token) return token
    return await this.wxLogin()
  },

  async refreshPets() {
    try {
      const API = require('./utils/api')
      const pets = await API.Pet.list()
      if (pets && pets.length > 0) {
        // API.Pet.list 已做标准化（f_name→name, f_id→id），直接使用
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
