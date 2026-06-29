const app = getApp()

Page({
  data: {
    products: [],
    categories: [
      { key: 'all', name: '全部' },
      { key: 'nfc', name: '智能设备' },
      { key: 'beads', name: '香珠' },
      { key: 'food', name: '食品' },
      { key: 'insurance', name: '保险' }
    ],
    activeCategory: 'all',
    loading: true
  },

  onLoad() {
    this.loadProducts()
  },

  loadProducts() {
    this.setData({ loading: true })
    const { MockAPI } = require('../../utils/mock')
    MockAPI.getProducts().then(res => {
      const products = (res && res.data) ? res.data : []
      this.setData({ products, loading: false })
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  switchCategory(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeCategory: key })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/shop/detail/detail?id=' + id })
  }
})
