const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    currentPet: null,
    pets: [],
    showAuth: false,
    pendingOrders: 0,
    hasHardware: false,
    hardwareFreeCount: 0,
    constitutionReminder: '',
    seasonReminder: ''
  },

  onShow() { this.loadData() },

  loadData() {
    const isLoggedIn = app.globalData.isLoggedIn
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const currentPet = app.globalData.currentPet || (pets.length > 0 ? pets[0] : null)
    const cart = wx.getStorageSync('cart') || []
    const hasHardware = wx.getStorageSync('hasHardware') || false
    const hardwareFreeCount = hasHardware ? 3 : 0

    // 季度提醒逻辑
    const now = new Date()
    const month = now.getMonth()
    let seasonName = ''
    if (month >= 2 && month <= 4) seasonName = '春季'
    else if (month >= 5 && month <= 7) seasonName = '夏季'
    else if (month >= 8 && month <= 10) seasonName = '秋季'
    else seasonName = '冬季'

    // 检查是否临近新季度（前5天）
    const dayOfMonth = now.getDate()
    const nextSeasonMonths = [2, 5, 8, 11] // 3月、6月、9月、12月开始
    const daysInMonth = new Date(now.getFullYear(), month + 1, 0).getDate()
    const isNearNewSeason = nextSeasonMonths.includes(month + 1) && dayOfMonth > daysInMonth - 5

    // 检查上次体质报告时间
    const lastReport = wx.getStorageSync('lastHealthReport') || ''
    let constitutionReminder = ''
    if (currentPet && !lastReport) {
      constitutionReminder = '建议每个季度生成新的宠物体质分析报告，掌握宠物健康变化趋势'
    } else if (isNearNewSeason && currentPet) {
      constitutionReminder = '即将进入' + seasonName + '，建议重新生成宠物体质分析报告'
    }

    this.setData({
      isLoggedIn, userInfo, pets, currentPet,
      pendingOrders: cart.length,
      hasHardware,
      hardwareFreeCount,
      constitutionReminder,
      seasonReminder: isNearNewSeason && currentPet ? '即将进入' + seasonName + '，建议重新生成体质报告' : ''
    })
  },

  showAuth() { this.setData({ showAuth: true }) },
  onAuthSuccess() { this.setData({ showAuth: false }); this.loadData() },
  onAuthCancel() { this.setData({ showAuth: false }) },

  switchPet(e) {
    const petId = e.currentTarget.dataset.id
    app.switchPet(petId)
    this.loadData()
  },

  goPets() { wx.navigateTo({ url: '/pages/mine/pets/pets' }) },
  goAddPet() { wx.navigateTo({ url: '/pages/mine/pets/edit/edit' }) },
  goOwnerProfile() {
    wx.showModal({
      title: '主人档案',
      content: '主人档案包含：\n· 基本信息（年龄/职业/居住地）\n· 健康状况\n· 养宠经验\n· 饮食偏好\n\n档案一次录入，全模块共享。\n支持随时调整。',
      showCancel: true,
      confirmText: '编辑档案',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '主人档案功能开发中', icon: 'none' })
        }
      }
    })
  },
  goHistory() { wx.navigateTo({ url: '/pages/mine/history/history' }) },
  goFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }) },
  goOrders() { wx.navigateTo({ url: '/pages/mine/orders/orders' }) },
  goHealth() {
    if (this.data.currentPet) {
      wx.navigateTo({ url: '/pages/health/health' })
    } else {
      wx.showToast({ title: '请先添加宠物', icon: 'none' })
    }
  },
  goHardware() { this.goDeviceBind() },
  goInsurance() { wx.navigateTo({ url: '/pages/insurance/insurance' }) },
  goDeviceBind() {
    const hasHardware = this.data.hasHardware
    if (hasHardware) {
      wx.showModal({
        title: '已绑定设备',
        content: '当前已绑定灵犀NFC项圈。\n可享受：医疗科普3次 · 风险预警3次\n体质分析1次 · 性格分析1次',
        showCancel: true,
        confirmText: '管理设备',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            wx.showToast({ title: '设备管理功能开发中', icon: 'none' })
          }
        }
      })
    } else {
      wx.showModal({
        title: '绑定智能设备',
        content: '支持绑定灵犀NFC项圈、智能喂食器、饮水机等MCP IoT设备。\n\n购买灵犀NFC项圈即享多项免费权益！',
        showCancel: true,
        confirmText: '去购买',
        cancelText: '绑定已有设备',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/shop/shop' })
          } else {
            wx.showToast({ title: '蓝牙扫描功能开发中', icon: 'none' })
          }
        }
      })
    }
  },
  goAgent() { wx.navigateTo({ url: '/pages/mine/agent/agent' }) },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) },
  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '客服微信：Gengdongta_KF\n工作时间：9:00-21:00',
      showCancel: true
    })
  },
  goSettings() { wx.navigateTo({ url: '/pages/mine/settings/settings' }) }
})
