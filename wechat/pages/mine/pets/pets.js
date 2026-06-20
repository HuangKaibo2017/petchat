const app = getApp()
Page({
  data: { pets: [] },
  onShow() { this.setData({ pets: app.globalData.pets || wx.getStorageSync('pets') || [] }) },
  goEditPet(e) {
    wx.navigateTo({ url: `/pages/mine/pets/edit/edit?id=${e.detail.pet.id}` })
  },
  goAddPet() { wx.navigateTo({ url: '/pages/mine/pets/edit/edit' }) }
})
