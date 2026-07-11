const API = require('../../../utils/api')

Page({
  data: {
    product: null,
    loading: true,
    cartCount: 0
  },

  onShow() {
    this.setData({ cartCount: getApp().getCartCount() })
  },

  async onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    try {
      const product = await API.Product.detail(options.id)
      if (!product) {
        wx.showToast({ title: '商品不存在', icon: 'none' })
        this.setData({ loading: false })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      this.setData({
        product: Object.assign({}, product, {
          displayName: product.detail && product.detail.title ? product.detail.title : product.name,
          displaySummary: product.detail && product.detail.summary ? product.detail.summary : ''
        }),
        loading: false
      })
    } catch (err) {
      console.warn('[Detail] 加载商品详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  previewImage(e) {
    const { product } = this.data
    if (!product) return

    wx.previewImage({
      current: e.currentTarget.dataset.image,
      urls: product.images
    })
  },

  goCart() {
    wx.navigateTo({ url: '/pages/shop/cart/cart' })
  },

  onAddToCart() {
    const { product } = this.data
    if (!product) return

    const app = getApp()
    app.addToCart(product, 1)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onBuyNow() {
    const { product } = this.data
    if (!product) return

    const app = getApp()
    app.addToCart(product, 1)
    wx.navigateTo({ url: '/pages/shop/cart/cart' })
  }
})
