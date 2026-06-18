Page({
  data: { product: {} },
  onLoad(options) {
    const products = [
      { id: 'nfc001', name: '灵犀NFC项圈', desc: '扫码即达·宠物智能身份', price: '299', image: '/images/product-nfc.png' },
      { id: 'bead001', name: '合香安神香珠', desc: '舒缓情绪·天然合香', price: '168', image: '/images/product-bead.png' }
    ]
    const product = products.find(p => p.id === options.id) || products[0]
    this.setData({ product })
  },
  addToCart() {
    let cart = wx.getStorageSync('cart') || []
    cart.push({ ...this.data.product, cartId: Date.now() })
    wx.setStorageSync('cart', cart)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },
  buyNow() { wx.navigateTo({ url: '/pages/shop/checkout/checkout' }) },
  goCart() { wx.navigateTo({ url: '/pages/shop/cart/cart' }) }
})
