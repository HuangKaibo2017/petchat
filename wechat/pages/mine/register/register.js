const app = getApp()
const API = require('../../../utils/api')

Page({
  data: {
    ownerName: '',
    phone: '',
    birthday: '',
    breedList: [],
    breedIdList: [],
    submitting: false,
    pets: [{
      name: '', breed: '', breedId: null, age: '', gender: '', neutered: null,
      history: '', vaccine: '', avatar: ''
    }]
  },

  onLoad() {
    this.loadBreeds()
  },

  async loadBreeds() {
    try {
      const breeds = await API.Pet.breeds()
      if (breeds && breeds.length > 0) {
        this.setData({
          breedList: breeds.map(b => b.name),
          breedIdList: breeds.map(b => b.id)
        })
      }
    } catch (err) {
      console.warn('[Register] 加载品种失败:', err.message)
      const util = require('../../../utils/util')
      this.setData({ breedList: util.breedList })
    }
  },

  onFieldInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [field]: e.detail.value })
  },

  onBirthdayChange(e) {
    this.setData({ birthday: e.detail.value })
  },

  onPetFieldInput(e) {
    const { index, field } = e.currentTarget.dataset
    const pets = [...this.data.pets]
    pets[index][field] = e.detail.value
    this.setData({ pets })
  },

  onBreedChange(e) {
    const index = e.currentTarget.dataset.index
    const breedIndex = parseInt(e.detail.value)
    const pets = [...this.data.pets]
    pets[index].breed = this.data.breedList[breedIndex] || ''
    pets[index].breedId = this.data.breedIdList[breedIndex] || null
    this.setData({ pets })
  },

  selectGender(e) {
    const { index, gender } = e.currentTarget.dataset
    const pets = [...this.data.pets]
    pets[index].gender = gender
    this.setData({ pets })
  },

  selectNeutered(e) {
    const { index, value } = e.currentTarget.dataset
    const pets = [...this.data.pets]
    pets[index].neutered = value === 'true'
    this.setData({ pets })
  },

  choosePetAvatar(e) {
    const index = e.currentTarget.dataset.index
    wx.chooseImage({
      count: 1, sizeType: ['compressed'],
      success: (res) => {
        const pets = [...this.data.pets]
        pets[index].avatar = res.tempFilePaths[0]
        this.setData({ pets })
      }
    })
  },

  addPet() {
    if (this.data.pets.length >= 5) return wx.showToast({ title: '最多添加5只宠物', icon: 'none' })
    this.setData({
      pets: [...this.data.pets, {
        name: '', breed: '', breedId: null, age: '', gender: '', neutered: null,
        history: '', vaccine: '', avatar: ''
      }]
    })
  },

  removePet(e) {
    const index = e.currentTarget.dataset.index
    const pets = this.data.pets.filter((_, i) => i !== index)
    this.setData({ pets })
  },

  async submitRegister() {
    const { ownerName, phone, birthday, pets } = this.data

    if (!ownerName.trim()) return wx.showToast({ title: '请输入姓名', icon: 'none' })
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return wx.showToast({ title: '请输入正确的11位手机号', icon: 'none' })

    for (let i = 0; i < pets.length; i++) {
      if (!pets[i].name.trim()) return wx.showToast({ title: `请输入宠物${i+1}的名字`, icon: 'none' })
    }

    if (!app.globalData.isLoggedIn) {
      const token = await app.wxLogin()
      if (!token) {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
        return
      }
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '注册中...' })

    try {
      for (const pet of pets) {
        let avatarUrl = ''

        if (pet.avatar) {
          try {
            const uploadResult = await API.Upload.upload(pet.avatar, 'pet_avatar', 0)
            avatarUrl = uploadResult.publicUrl
          } catch (e) {
            console.warn('Avatar upload failed:', e)
          }
        }

        const petPayload = {
          name: pet.name,
          breedId: pet.breedId,
          genderId: pet.gender === 'male' ? 1 : pet.gender === 'female' ? 2 : -1,
          birthYear: pet.age ? (new Date().getFullYear() - parseInt(pet.age)) : null,
          sterilized: pet.neutered,
          vaccinated: pet.vaccine === 'yes',
          tags: [],
          avatar: avatarUrl,
          history: pet.history || '',
          vaccineNote: pet.vaccine === 'yes' ? '已接种疫苗' : '',
        }

        await API.Pet.save(petPayload)
      }

      // 保存主人信息
      const ownerPayload = { nickname: ownerName, phone }
      if (birthday) {
        ownerPayload.birthday = birthday
      }
      try {
        await API.User.updateProfile(ownerPayload)
      } catch (e) {
        console.warn('[Register] 保存主人信息失败:', e.message)
      }

      wx.hideLoading()
      wx.showToast({ title: '注册成功', icon: 'success' })

      await app.refreshPets()

      setTimeout(() => { wx.switchTab({ url: '/pages/index/index' }) }, 1500)
    } catch (err) {
      wx.hideLoading()
      console.error('Registration failed:', err)
      wx.showToast({ title: '注册失败，请重试', icon: 'none' })
    }

    this.setData({ submitting: false })
  }
})
