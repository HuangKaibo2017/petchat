const util = require('../../../utils/util')
const app = getApp()
const API = require('../../../utils/api')

Page({
  data: {
    ownerName: '',
    phone: '',
    birthday: '',
    breedList: util.breedList,
    submitting: false,
    pets: [{
      name: '', breed: '', breedIndex: -1, age: '', gender: '', neutered: null,
      history: '', vaccine: '', avatar: ''
    }]
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
    pets[index].breed = this.data.breedList[breedIndex]
    pets[index].breedIndex = breedIndex
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
        name: '', breed: '', breedIndex: -1, age: '', gender: '', neutered: null,
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
    if (!phone || phone.length < 11) return wx.showToast({ title: '请输入正确的手机号', icon: 'none' })

    for (let i = 0; i < pets.length; i++) {
      if (!pets[i].name.trim()) return wx.showToast({ title: `请输入宠物${i+1}的名字`, icon: 'none' })
      if (!pets[i].breed) return wx.showToast({ title: `请选择宠物${i+1}的品种`, icon: 'none' })
    }

    // Ensure authorized
    if (!app.globalData.isAuthorized) {
      app.requestAuth(() => this.submitRegister())
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '注册中...' })

    try {
      // Save pets via PostgREST
      for (const pet of pets) {
        let avatarUrl = ''

        // Upload avatar if present
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
          breedId: pet.breedIndex + 1,
          genderId: pet.gender === 'male' ? 1 : pet.gender === 'female' ? 2 : -1,
          age: pet.age ? parseInt(pet.age) : null,
          sterilized: pet.neutered,
          vaccinated: pet.vaccine === 'yes',
          tags: ['平和质'],
          avatar: avatarUrl,
        }

        await API.Pet.create(petPayload)
      }

      wx.hideLoading()
      wx.showToast({ title: '注册成功', icon: 'success' })

      // Refresh pets from backend
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
