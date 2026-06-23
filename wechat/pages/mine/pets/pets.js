const app = getApp()
Page({
  data: { pets: [] },
  onShow() { this.setData({ pets: app.globalData.pets || wx.getStorageSync('pets') || [] }) },
  goDetailPet(e) {
    wx.navigateTo({ url: `/pages/mine/pets/detail/detail?id=${e.detail.pet.id}` })
  },
  goAddPet() { wx.navigateTo({ url: '/pages/mine/pets/edit/edit' }) }
})
