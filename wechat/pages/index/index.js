const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    currentPet: null,
    pets: [],
    nfcEnabled: true,
    showAuth: false,

    // 1. Banner 分区：主力 Banner
    majorBanners: [
      {
        id: 1, tag: '新人礼', title: '免费1个月医疗险', desc: '新用户专享，立即领取',
        bg: 'linear-gradient(135deg, #2D7D6E, #5BA89A)',
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

    // 救助 Banner（次要，弱化曝光）
    rescueBanner: {
      id: 1, title: '救助专区', desc: '流浪求助 · 宠物领养 · 捐赠积分',
      bg: 'linear-gradient(135deg, #F97316, #FB923C)',
      url: '/pages/rescue/rescue'
    },

    rescueStats: { activeCount: 12 },

    // 3. 养护知识文章
    knowledgeArticles: [
      {
        id: 1, tag: '养护', title: '猫咪春季换毛护理指南', desc: '3招缓解掉毛困扰',
        emoji: '🐱', bg: 'linear-gradient(135deg, #FDE68A, #FBBF24)',
        url: '/pages/medical/detail/detail?id=care1'
      },
      {
        id: 2, tag: '营养', title: '狗狗四季饮食搭配', desc: '中医食疗养宠法',
        emoji: '🐕', bg: 'linear-gradient(135deg, #BFDBFE, #60A5FA)',
        url: '/pages/medical/detail/detail?id=care2'
      },
      {
        id: 3, tag: '行为', title: '读懂宠物的肢体语言', desc: '10个常见信号解读',
        emoji: '🔍', bg: 'linear-gradient(135deg, #DDD6FE, #A78BFA)',
        url: '/pages/medical/detail/detail?id=care3'
      },
      {
        id: 4, tag: '健康', title: '宠物口腔护理全攻略', desc: '预防牙结石从小做起',
        emoji: '🦷', bg: 'linear-gradient(135deg, #D1FAE5, #34D399)',
        url: '/pages/medical/detail/detail?id=care4'
      }
    ],

    // 5. 宠友圈热帖
    hotFeeds: [
      {
        id: 1, nickname: '猫咪爱好者', avatar: '', time: '2小时前',
        content: '我家小橘戴上灵犀项圈后，出门再也不怕走丢了！推荐所有养猫家庭入手~',
        image: '', likes: 128, comments: 23
      },
      {
        id: 2, nickname: '宠物达人小王', avatar: '', time: '5小时前',
        content: '分享一个猫咪不爱喝水的解决办法：用流动饮水机+放一点猫薄荷，亲测有效！',
        image: '', likes: 256, comments: 45
      },
      {
        id: 3, nickname: '柯基麻麻', avatar: '', time: '8小时前',
        content: '用宠物体质分析发现我家柯基原来是阳虚体质，怪不得总怕冷！按报告调理两周后明显活泼多了~',
        image: '', likes: 89, comments: 12
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
    // NFC 欢迎语
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

  // ─── 授权 ───
  checkAuth(callback) {
    if (app.globalData.isAuthorized) {
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

  // ─── 核心工具导航 ───
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

  // ─── 救助专区 ───
  goRescue() { wx.navigateTo({ url: '/pages/rescue/rescue' }) },
  goRescueHelp() { wx.navigateTo({ url: '/pages/rescue/rescue?tab=help' }) },
  goRescueAdopt() { wx.navigateTo({ url: '/pages/rescue/rescue?tab=adopt' }) },
  goRescueDonate() { wx.navigateTo({ url: '/pages/rescue/rescue?tab=donate' }) },

  // ─── 照片区 ───
  goPhotoWatermark() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/photo/photo?mode=watermark' }))
  },
  goPhotoComic() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/photo/photo?mode=comic' }))
  },
  goPhotoSeries() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/photo/photo?mode=series' }))
  },

  // ─── 内容联动 ───
  goArticle(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/medical/detail/detail?id=' + id })
  },
  goCommunity() {
    wx.navigateTo({ url: '/pages/community/community' })
  },
  goFeedDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/community/post/post?id=' + id })
  },

  goHospitals() { wx.navigateTo({ url: '/pages/hospitals/hospitals' }) },
  goHospitalDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/hospitals/detail/detail?id=' + id })
  },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) },
  goProductDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/shop/detail/detail?id=' + id })
  },
  goRegister() {
    this.checkAuth(() => wx.navigateTo({ url: '/pages/mine/register/register' }))
  },
  onBannerTap(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.navigateTo({ url })
  },

  onShareAppMessage() {
    return { title: '更懂它 - 懂宠物，更懂你', path: '/pages/index/index' }
  }
})
