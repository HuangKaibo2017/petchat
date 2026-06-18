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
  save() {
    const pets = app.globalData.pets || []
    const pet = this.data.pet
    if (!pet.name) return wx.showToast({ title: '请输入名字', icon: 'none' })
    if (this.data.isEdit) {
      const idx = pets.findIndex(p => p.id === pet.id)
      if (idx > -1) pets[idx] = pet
    } else {
      pet.id = `pet_${Date.now()}`
      pet.tags = ['平和质']
      pets.push(pet)
    }
    wx.setStorageSync('pets', pets)
    app.globalData.pets = pets
    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  },
  deletePet() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          let pets = app.globalData.pets.filter(p => p.id !== this.data.pet.id)
          wx.setStorageSync('pets', pets)
          app.globalData.pets = pets
          wx.navigateBack()
        }
      }
    })
  }
})
