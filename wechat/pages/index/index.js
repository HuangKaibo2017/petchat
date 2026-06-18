const app = getApp()

Page({
  data: {
    currentPet: null,
    pets: [],
    nfcEnabled: true,
    showAuth: false,
    banners: [
      {
        id: 1, tag: '新人礼', title: '免费1个月医疗险', desc: '新用户专享，立即领取',
        bg: 'linear-gradient(135deg, #F97316, #FB923C)',
        image: '/images/banner-insurance.png', url: '/pages/insurance/insurance'
      },
      {
        id: 2, tag: '限时活动', title: '灵犀NFC项圈首发', desc: '限量预售，扫码即达',
        bg: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
        image: '/images/banner-nfc.png', url: '/pages/shop/detail/detail?id=nfc001'
      },
      {
        id: 3, tag: '推荐', title: '24小时宠物医院', desc: '查看附近合作医院',
        bg: 'linear-gradient(135deg, #22C55E, #4ADE80)',
        image: '/images/banner-hospital.png', url: '/pages/hospitals/hospitals'
      }
    ],
    nearHospitals: [
      { id: 1, name: '瑞鹏宠物医院(南山店)', rating: '4.8', distance: '1.2km', tags: ['24小时', '直付'] },
      { id: 2, name: '芭比堂动物医院', rating: '4.7', distance: '2.5km', tags: ['中医', '康复'] },
      { id: 3, name: '爱诺动物医院', rating: '4.6', distance: '3.1km', tags: ['急诊', '手术'] }
    ],
    recommendProducts: [
      { id: 1, name: '灵犀NFC项圈', price: '299', image: '/images/product-nfc.png' },
      { id: 2, name: '合香香珠·安神款', price: '168', image: '/images/product-bead.png' }
    ]
  },

  onLoad(options) {
    this.loadPetData()
    if (options.nfcPetId) {
      this.handleNfcScan(options.nfcPetId)
    }
  },

  onShow() {
    this.loadPetData()
    if (!app.globalData.isAuthorized) {
      // Only show auth when user clicks a feature
    }
  },

  loadPetData() {
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const currentPet = app.globalData.currentPet
    this.setData({ pets, currentPet, currentPetId: currentPet ? currentPet.id : null })
  },

  handleNfcScan(petId) {
    const pet = this.data.pets.find(p => p.id === petId)
    if (pet) {
      app.switchPet(petId)
      this.loadPetData()
      wx.showToast({ title: `已识别 ${pet.name}`, icon: 'none' })
    }
  },

  checkAuth(callback) {
    if (!app.globalData.isAuthorized) {
      this.setData({ showAuth: true, pendingAction: callback })
      return false
    }
    return true
  },

  onAuthSuccess() {
    this.setData({ showAuth: false })
    if (this.data.pendingAction) {
      this.data.pendingAction()
      this.data.pendingAction = null
    }
  },

  onAuthCancel() {
    this.setData({ showAuth: false, pendingAction: null })
  },

  // Navigation
  goRegister() { wx.navigateTo({ url: '/pages/mine/register/register' }) },
  goEmotion() {
    if (!this.checkAuth(() => wx.navigateTo({ url: '/pages/emotion/emotion' }))) return
    wx.navigateTo({ url: '/pages/emotion/emotion' })
  },
  goHealth() {
    if (!this.checkAuth(() => wx.navigateTo({ url: '/pages/health/health' }))) return
    wx.navigateTo({ url: '/pages/health/health' })
  },
  goPersonality() {
    if (!this.checkAuth(() => wx.navigateTo({ url: '/pages/emotion/emotion?type=personality' }))) return
    wx.navigateTo({ url: '/pages/emotion/emotion?type=personality' })
  },
  goRisk() {
    if (!this.checkAuth(() => wx.navigateTo({ url: '/pages/risk/risk' }))) return
    wx.navigateTo({ url: '/pages/risk/risk' })
  },
  goMedical() { wx.navigateTo({ url: '/pages/medical/medical' }) },
  goNewPet() { wx.navigateTo({ url: '/pages/medical/medical?type=newpet' }) },
  goMimicChat() {
    if (!this.checkAuth(() => wx.switchTab({ url: '/pages/chat/chat' }))) return
    wx.switchTab({ url: '/pages/chat/chat' })
  },
  goLostPet() {
    if (!this.checkAuth(() => wx.navigateTo({ url: '/pages/service/service?tab=lost' }))) return
    wx.navigateTo({ url: '/pages/service/service?tab=lost' })
  },
  goRescue() {
    wx.navigateTo({ url: '/pages/community/community?tab=rescue' })
  },
  goHospitals() { wx.navigateTo({ url: '/pages/hospitals/hospitals' }) },
  goHospitalDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/hospitals/detail/detail?id=${id}` })
  },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) },
  goProductDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/shop/detail/detail?id=${id}` })
  },
  onBannerTap(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.navigateTo({ url })
  },

  // Share
  onShareAppMessage() {
    return { title: 'PetChat 灵犀 - 懂宠物，更懂你', path: '/pages/index/index' }
  }
})
