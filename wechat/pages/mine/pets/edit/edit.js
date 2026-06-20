const API = require('../../../../utils/api')
const app = getApp()

Page({
  data: { isEdit: false, pet: {} },

  onLoad(options) {
    if (options.id) {
      const pets = app.globalData.pets || wx.getStorageSync('pets') || []
      const pet = pets.find(p => p.id === options.id)
      if (pet) this.setData({ isEdit: true, pet: { ...pet } })
    }
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [`pet.${field}`]: e.detail.value })
  },

  async save() {
    const pet = this.data.pet
    if (!pet.name || !pet.name.trim()) return wx.showToast({ title: '请输入名字', icon: 'none' })

    wx.showLoading({ title: '保存中...' })

    try {
      if (this.data.isEdit) {
        await API.Pet.update(pet.id, pet)
      } else {
        pet.tags = pet.tags || ['平和质']
        const result = await API.Pet.save(pet)
        if (result && result.id) pet.id = result.id
      }

      // 刷新本地和全局数据
      const pets = await API.Pet.list()
      if (pets && pets.length > 0) {
        wx.setStorageSync('pets', pets)
        app.globalData.pets = pets
      } else {
        // 兜底：直接操作本地数据
        const localPets = app.globalData.pets || []
        if (this.data.isEdit) {
          const idx = localPets.findIndex(p => p.id === pet.id)
          if (idx > -1) localPets[idx] = pet
        } else {
          pet.id = pet.id || `pet_${Date.now()}`
          localPets.push(pet)
        }
        wx.setStorageSync('pets', localPets)
        app.globalData.pets = localPets
      }

      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      wx.hideLoading()
      console.warn('宠物保存失败，使用本地存储:', err)
      // 降级：直接写本地存储
      const localPets = app.globalData.pets || []
      if (this.data.isEdit) {
        const idx = localPets.findIndex(p => p.id === pet.id)
        if (idx > -1) localPets[idx] = pet
      } else {
        pet.id = pet.id || `pet_${Date.now()}`
        pet.tags = pet.tags || ['平和质']
        localPets.push(pet)
      }
      wx.setStorageSync('pets', localPets)
      app.globalData.pets = localPets
      wx.showToast({ title: '已本地保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  deletePet() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.Pet.delete(this.data.pet.id)
          } catch (e) {
            console.warn('远程删除失败，本地删除:', e)
          }
          let pets = (app.globalData.pets || []).filter(p => p.id !== this.data.pet.id)
          wx.setStorageSync('pets', pets)
          app.globalData.pets = pets
          wx.navigateBack()
        }
      }
    })
  }
})
