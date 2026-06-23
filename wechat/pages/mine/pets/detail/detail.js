const API = require('../../../../utils/api')
const app = getApp()

Page({
  data: {
    pet: {},
    isLoading: true
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.loadPet(options.id)
  },

  onShow() {
    const pages = getCurrentPages()
    if (pages.length > 1 && pages[pages.length - 2].route.includes('edit')) {
      const pets = app.globalData.pets || wx.getStorageSync('pets') || []
      const pet = pets.find(p => p.id === this.data.pet.id)
      if (pet) this.setData({ pet })
    }
  },

  loadPet(id) {
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const pet = pets.find(p => p.id === id)
    if (pet) {
      this.setData({ pet, isLoading: false })
    } else {
      wx.showToast({ title: '宠物不存在', icon: 'none' })
      this.setData({ isLoading: false })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  goEdit() {
    wx.navigateTo({
      url: `/pages/mine/pets/edit/edit?id=${this.data.pet.id}`
    })
  },

  deletePet() {
    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${this.data.pet.name}」的档案吗？删除后无法恢复。`,
      confirmColor: '#E74C3C',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '删除中...' })

        try {
          await API.Pet.delete(this.data.pet.id)
        } catch (e) {
          console.warn('远程删除失败，本地删除:', e)
        }

        let pets = (app.globalData.pets || []).filter(p => p.id !== this.data.pet.id)
        wx.setStorageSync('pets', pets)
        app.globalData.pets = pets

        wx.hideLoading()
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      }
    })
  }
})
