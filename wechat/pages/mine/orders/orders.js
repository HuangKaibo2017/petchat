Page({
  data: { activeTab: 'all' },
  switchTab(e) { this.setData({ activeTab: e.currentTarget.dataset.tab }) },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) }
})
