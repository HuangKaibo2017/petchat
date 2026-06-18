const app = getApp()

Page({
  data: {
    isAuthorized: false,
    userInfo: null,
    currentPet: null,
    pets: [],
    showAuth: false,
    pendingOrders: 0
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const isAuthorized = app.globalData.isAuthorized
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const currentPet = app.globalData.currentPet
    this.setData({ isAuthorized, userInfo, pets, currentPet })
  },

  showAuth() {
    this.setData({ showAuth: true })
  },
  onAuthSuccess() {
    this.setData({ showAuth: false })
    this.loadData()
  },
  onAuthCancel() {
    this.setData({ showAuth: false })
  },

  switchPet(e) {
    const petId = e.currentTarget.dataset.id
    app.switchPet(petId)
    this.loadData()
  },

  // Navigation
  goPets() { wx.navigateTo({ url: '/pages/mine/pets/pets' }) },
  goAddPet() { wx.navigateTo({ url: '/pages/mine/pets/edit/edit' }) },
  goHistory() { wx.navigateTo({ url: '/pages/mine/history/history' }) },
  goFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }) },
  goOrders() { wx.navigateTo({ url: '/pages/mine/orders/orders' }) },
  goInsurance() { wx.navigateTo({ url: '/pages/insurance/insurance' }) },
  goDeviceBind() { wx.showToast({ title: '设备绑定功能开发中', icon: 'none' }) },
  goAgent() { wx.navigateTo({ url: '/pages/mine/agent/agent' }) },
  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '客服微信：PetChat_KF\n工作时间：9:00-21:00',
      showCancel: true
    })
  },
  goSettings() { wx.navigateTo({ url: '/pages/mine/settings/settings' }) }
})
