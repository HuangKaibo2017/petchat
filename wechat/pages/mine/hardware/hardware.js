Page({
  data: {
    devices: [],
    freeCounts: { medical: 3, risk: 3, emotion: 30, health: 1, personality: 1 }
  },
  onLoad() {
    // Load from storage
    const counts = wx.getStorageSync('_hardware_free_counts') || {}
    if (Object.keys(counts).length) this.setData({ freeCounts: counts })
  },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) }
})
