const app = getApp()

Page({
  data: {
    currentPet: {},
    showPetDropdown: false,
    descText: '',
    qpCare: '',
    qpEnergy: '',
    qpIntuition: '',
    photoList: [],
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
    hardwareList: [
      { id: 1, name: '智能项圈', image: '', active: false },
      { id: 2, name: 'NFC贴',    image: '', active: true },
      { id: 3, name: '语音盒',   image: '', active: false }
    ],

    // 弹层状态
    showOwnerForm: false,
    showPetForm: false,
    editingPetIndex: -1,

    // 表单数据
    ownerForm: {},
    petForm: {},

    // 选项
    dietOptions: ['无特殊偏好', '素食', '杂食', '生骨肉', '处方粮'],
    expOptions: ['新手', '1-3年', '3-5年', '5年以上'],
    genderOptions: ['公', '母'],
  },

  onLoad() {
    this.loadUserInfo()
    this.loadOwnerProfile()
    this.loadPets()
    this.loadDefaultPet()
    this.loadDeviceCounts()
    this.loadQuota()
  },

  onShow() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({
      avatarUrl: userInfo.avatarUrl || '',
      nickname: userInfo.nickName || ''
    })
  },

  loadOwnerProfile() {
    const profile = wx.getStorageSync('ownerProfile') || {}
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
  },

  loadPets() {
    const pets = wx.getStorageSync('pets') || []
    this.setData({ pets })
  },

  loadDefaultPet() {
    const pets = this.data.pets
    if (pets.length > 0 && !this.data.currentPet.id) {
      this.setData({ currentPet: pets[0] })
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

  saveOwnerProfile(profile) {
    wx.setStorageSync('ownerProfile', profile)
    this.loadOwnerProfile()
  },

  // ─── 上传照片 ───
  addPhoto() {
    wx.chooseImage({
      count: 9 - this.data.photoList.length,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        this.setData({
          photoList: [...this.data.photoList, ...res.tempFilePaths]
        })
      }
    })
  },

  delPhoto(e) {
    const index = e.currentTarget.dataset.index
    const list = [...this.data.photoList]
    list.splice(index, 1)
    this.setData({ photoList: list })
  },


  onQpInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ descText: e.detail.value })
  },

  showDescTip() {
    wx.showToast({ title: '描述宠物近期的行为变化、情绪表现、饮食睡眠等', icon: 'none', duration: 2500 })
  },

  togglePetList() {
    this.setData({ showPetDropdown: !this.data.showPetDropdown })
  },

  selectPet(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentPet: this.data.pets[index],
      showPetDropdown: false
    })
  },

  savePets(pets) {
    wx.setStorageSync('pets', pets)
    this.loadPets()
    this.loadDefaultPet()
  },

  // ─── 头像昵称区域点击 ───
  goLogin() {
    if (!this.data.nickname) {
      wx.getUserProfile({
        desc: '用于完善个人资料',
        success: (res) => {
          const { avatarUrl, nickName } = res.userInfo
          wx.setStorageSync('userInfo', { avatarUrl, nickName })
          this.setData({ avatarUrl, nickname: nickName })
          wx.showToast({ title: '登录成功', icon: 'success' })
        },
        fail: () => {
          wx.showToast({ title: '已取消', icon: 'none' })
        }
      })
    }
  },

  // ─── 主人档案 ───
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
    wx.showToast({ title: '保存成功', icon: 'success' })
    this.closeOwnerForm()
  },

  // ─── 宠物档案 ───
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
      petForm: { ...pet }
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

  submitPetForm() {
    const form = this.data.petForm
    if (!form.name) {
      wx.showToast({ title: '请填写宠物名字', icon: 'none' })
      return
    }
    const pets = [...this.data.pets]
    const idx = this.data.editingPetIndex
    const newPet = {
      ...form,
      id: idx >= 0 ? pets[idx].id : Date.now()
    }

    if (idx >= 0) {
      pets[idx] = newPet
    } else {
      pets.push(newPet)
    }

    this.savePets(pets)
    wx.showToast({ title: idx >= 0 ? '修改成功' : '添加成功', icon: 'success' })
    this.closePetForm()
  },

  // ─── 硬件绑定 ───
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

  // ─── 菜单点击 ───
  goContact() {
    wx.showToast({ title: '联系客服', icon: 'none' })
  },

  goAbout() {
    wx.showToast({ title: '关于我们', icon: 'none' })
  },

  goSettings() {
    wx.showToast({ title: '设置', icon: 'none' })
  },

  async generateReport() {
    if (!this.data.currentPet.id) {
      wx.showToast({ title: '请先选择宠物', icon: 'none' })
      return
    }
    const API = require('../../utils/api')
    this.setData({ submitting: true })
    wx.showLoading({ title: '解读中...' })

    try {
      const result = await API.Report.emotion({
        petId: this.data.currentPet.id,
        question: this.data.descText || '宠物最近状态如何?',
        imageUrl: this.data.photoList[0] || '',
      })
      wx.hideLoading()
      const app = getApp()
      app.globalData._lastEmotionReport = result
      wx.navigateTo({ url: '/pages/emotion/report/report' })
    } catch (err) {
      wx.hideLoading()
      console.error('[emotion] generate error:', err)
      wx.navigateTo({ url: '/pages/emotion/report/report' })
    }
    this.setData({ submitting: false })
  }
})
