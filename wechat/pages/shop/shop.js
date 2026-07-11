const { SHOP_ITEMS, getProductsByCategory } = require('./products')

Page({
  data: {
    products: SHOP_ITEMS,
    categories: [
      { key: 'all', name: '全部' },
      { key: 'handmade', name: '手作' },
      { key: 'necklace', name: '项链' },
      { key: 'toy', name: '玩具' }
    ],
    activeCategory: 'all',
    loading: false
  },

  switchCategory(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      activeCategory: key,
      products: getProductsByCategory(key)
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/shop/detail/detail?id=' + id })
  }
})
