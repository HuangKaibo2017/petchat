const API = require('../../utils/api')
const app = getApp()

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    owner: {
      age: '',
      occupation: '',
      city: '',
      phone: '',
      diet: '',
      experience: ''
    },
    pets: [],
    hwCurrent: 0,
    nfcCount: 0,
    deviceCount: 0,
    emotionQuota: 0,
    healthQuota: 0,
    riskQuota: 0,
    bodyQuota: 0,
    cartCount: 0,
    hardwareList: [
      { id: 1, name: '智能项圈', image: '', active: false },
      { id: 2, name: 'NFC贴',    image: '', active: true },
      { id: 3, name: '语音盒',   image: '', active: false }
    ],

    showAuthorize: false,
    showOwnerForm: false,
    showPetForm: false,
    editingPetIndex: -1,

    ownerForm: {},
    petForm: {},

    dietOptions: ['无特殊偏好', '素食', '杂食', '生骨肉', '处方粮'],
    expOptions: ['新手', '1-3年', '3-5年', '5年以上'],
    genderOptions: ['公', '母'],
  },

  onLoad() {
    this.loadUserInfo()
    this.loadOwnerProfile()
    this.loadPets()
    this.loadDeviceCounts()
    this.loadQuota()
  },

  onShow() {
    this.loadUserInfo()
    this.loadCartCount()
  },

  loadCartCount() {
    this.setData({ cartCount: app.getCartCount() })
  },

  loadUserInfo() {
    const ui = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
    this.setData({
      avatarUrl: ui.avatarUrl || '',
      nickname: ui.nickName || ui.nickname || ''
    })
  },

  async loadOwnerProfile() {
    try {
      const profile = await API.User.getProfile()
      if (profile) {
        this.setData({
          owner: {
            age: profile.age || '',
            occupation: profile.occupation || '',
            city: profile.city || '',
            phone: profile.phone || '',
            diet: profile.diet || '',
            experience: profile.experience || ''
          }
        })
        wx.setStorageSync('ownerProfile', profile)
      }
    } catch (err) {
      console.warn('[Mine] 加载主人档案失败，从缓存读取:', err.message)
      const cached = wx.getStorageSync('ownerProfile') || {}
      this.setData({
        owner: {
          age: cached.age || '',
          occupation: cached.occupation || '',
          city: cached.city || '',
          phone: cached.phone || '',
          diet: cached.diet || '',
          experience: cached.experience || ''
        }
      })
    }
  },

  async loadPets() {
    try {
      const pets = await API.Pet.list()
      if (pets && pets.length > 0) {
        this.setData({ pets })
        app.globalData.pets = pets
        wx.setStorageSync('pets', pets)
      } else if (app.globalData.pets && app.globalData.pets.length > 0) {
        this.setData({ pets: app.globalData.pets })
      }
    } catch (err) {
      console.warn('[Mine] 加载宠物失败:', err.message)
      this.setData({ pets: app.globalData.pets || [] })
    }
  },

  loadDeviceCounts() {
    const nfcList = wx.getStorageSync('nfcList') || []
    const deviceList = wx.getStorageSync('deviceList') || []
    this.setData({
      nfcCount: nfcList.length,
      deviceCount: deviceList.length
    })
  },

  loadQuota() {
    const quota = wx.getStorageSync('quota') || {}
    this.setData({
      emotionQuota: quota.emotion || 0,
      healthQuota: quota.health || 0,
      riskQuota: quota.risk || 0,
      bodyQuota: quota.body || 0
    })
  },

  async saveOwnerProfile(form) {
    try {
      await API.User.updateProfile(form)
      wx.setStorageSync('ownerProfile', form)
      this.loadOwnerProfile()
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      console.warn('[Mine] 保存主人档案失败:', err.message)
      wx.setStorageSync('ownerProfile', form)
      this.loadOwnerProfile()
      wx.showToast({ title: '已本地保存', icon: 'none' })
    }
  },

  // ═══ 头像昵称 ═══
  goLogin() {
    this.setData({ showAuthorize: true })
  },

  onAuthorizeSuccess(e) {
    const { nickName, avatarUrl } = e.detail
    const userInfo = { nickName, avatarUrl }
    wx.setStorageSync('userInfo', userInfo)
    app.globalData.userInfo = userInfo
    this.setData({ avatarUrl: avatarUrl || '', nickname: nickName || '', showAuthorize: false })

    if (nickName || avatarUrl) {
      API.User.updateProfile({ nickname: nickName, avatarUrl }).catch(() => {})
    }
    wx.showToast({ title: '设置成功', icon: 'success' })
  },

  onAuthorizeCancel() {
    this.setData({ showAuthorize: false })
  },

  // ═══ 主人档案 ═══
  goOwnerProfile() {
    this.setData({
      showOwnerForm: true,
      ownerForm: { ...this.data.owner }
    })
  },

  closeOwnerForm() {
    this.setData({ showOwnerForm: false })
  },

  onOwnerFieldInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ ['ownerForm.' + field]: e.detail.value })
  },

  onOwnerDietChange(e) {
    this.setData({ 'ownerForm.diet': this.data.dietOptions[e.detail.value] })
  },

  onOwnerExpChange(e) {
    this.setData({ 'ownerForm.experience': this.data.expOptions[e.detail.value] })
  },

  submitOwnerForm() {
    const form = this.data.ownerForm
    if (!form.age || !form.occupation || !form.city || !form.phone) {
      wx.showToast({ title: '请填写必填项', icon: 'none' })
      return
    }
    this.saveOwnerProfile(form)
    this.closeOwnerForm()
  },

  // ═══ 宠物档案 ═══
  goPetProfile() {},

  goAddPet() {
    this.setData({
      showPetForm: true,
      editingPetIndex: -1,
      petForm: {
        avatar: '',
        name: '',
        age: '',
        weight: '',
        gender: '',
        breed: '',
        health: '',
        allergy: '',
        tip: ''
      }
    })
  },

  goEditPet(e) {
    const index = e.currentTarget.dataset.index
    const pet = this.data.pets[index]
    this.setData({
      showPetForm: true,
      editingPetIndex: index,
      petForm: {
        avatar: pet.avatar || '',
        name: pet.name || '',
        age: pet.age || (pet.birthYear ? String(pet.birthYear) : ''),
        weight: pet.weight ? String(pet.weight) : '',
        gender: pet.gender || '',
        breed: pet.breed || '',
        health: pet.history || '',
        allergy: pet.allergy || '',
        tip: pet.vaccineNote || ''
      }
    })
  },

  closePetForm() {
    this.setData({ showPetForm: false })
  },

  onPetFieldInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ ['petForm.' + field]: e.detail.value })
  },

  onPetGenderChange(e) {
    this.setData({ 'petForm.gender': this.data.genderOptions[e.detail.value] })
  },

  async submitPetForm() {
    const form = this.data.petForm
    if (!form.name) {
      wx.showToast({ title: '请填写宠物名字', icon: 'none' })
      return
    }
    const idx = this.data.editingPetIndex

    const payload = {
      name: form.name,
      avatar: form.avatar || '',
      history: form.health || '',
      allergy: form.allergy || '',
      vaccineNote: form.tip || '',
    }

    if (form.gender === '公') payload.genderId = 1
    else if (form.gender === '母') payload.genderId = 2
    else payload.genderId = -1

    if (form.age && !isNaN(parseInt(form.age))) {
      payload.birthYear = new Date().getFullYear() - parseInt(form.age)
    }
    if (form.weight && !isNaN(parseFloat(form.weight))) {
      payload.weight = parseFloat(form.weight)
    }

    try {
      if (idx >= 0) {
        await API.Pet.update(this.data.pets[idx].id, payload)
      } else {
        await API.Pet.create(payload)
      }
      await app.refreshPets()
      await this.loadPets()
      wx.showToast({ title: idx >= 0 ? '修改成功' : '添加成功', icon: 'success' })
      this.closePetForm()
    } catch (err) {
      console.warn('[Mine] 保存宠物失败:', err.message)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  async deletePet(e) {
    const index = e.currentTarget.dataset.index
    const pet = this.data.pets[index]
    if (!pet) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${pet.name}」的档案吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await API.Pet.delete(pet.id)
          await app.refreshPets()
          await this.loadPets()
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          console.warn('[Mine] 删除宠物失败:', err.message)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  goDeviceBind() {
    wx.showToast({ title: '硬件绑定', icon: 'none' })
  },

  onHwChange(e) {
    this.setData({ hwCurrent: e.detail.current })
  },

  goNfcBind() {
    wx.showToast({ title: 'NFC 标签绑定', icon: 'none' })
  },

  goDeviceList() {
    wx.showToast({ title: '智能设备列表', icon: 'none' })
  },

  goContact() {
    wx.showToast({ title: '联系客服', icon: 'none' })
  },

  goAbout() {
    wx.showToast({ title: '关于我们', icon: 'none' })
  },

  goSettings() {
    wx.showToast({ title: '设置', icon: 'none' })
  },

  goCart() {
    wx.navigateTo({ url: '/pages/shop/cart/cart' })
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/mine/orders/orders' })
  }
})
