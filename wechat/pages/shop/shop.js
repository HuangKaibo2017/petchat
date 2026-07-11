const API = require('../../utils/api')

Page({
  data: {
    products: [],
    categories: [
      { key: 'all', name: '全部' },
      { key: 'handmade', name: '手作' },
      { key: 'necklace', name: '项链' },
      { key: 'toy', name: '玩具' }
    ],
    activeCategory: 'all',
    loading: true,
    cartCount: 0
  },

  onShow() {
    this.setData({ cartCount: getApp().getCartCount() })
  },

  onLoad() {
    this.loadProducts()
  },

  async loadProducts() {
    try {
      const products = await API.Product.list()
      this.setData({ products, loading: false })
    } catch (err) {
      console.warn('[Shop] 加载商品失败:', err)
      this.setData({ loading: false })
    }
  },

  switchCategory(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeCategory: key })
    if (key === 'all') {
      this.loadProducts()
    } else {
      this.loadProductsByCategory(key)
    }
  },

  async loadProductsByCategory(categoryCode) {
    try {
      const products = await API.Product.list({ category: categoryCode })
      this.setData({ products, loading: false })
    } catch (err) {
      console.warn('[Shop] 加载分类商品失败:', err)
      this.setData({ loading: false })
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/shop/detail/detail?id=' + id })
  },

  goCart() {
    wx.navigateTo({ url: '/pages/shop/cart/cart' })
  }
})
