Page({
  data: { cart: [], totalPrice: 0 },
  onShow() {
    const cart = wx.getStorageSync('cart') || []
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(item.price), 0)
    this.setData({ cart, totalPrice: totalPrice.toFixed(2) })
  },
  removeItem(e) {
    const id = e.currentTarget.dataset.id
    let cart = this.data.cart.filter(item => item.cartId !== id)
    wx.setStorageSync('cart', cart)
    const totalPrice = cart.reduce((sum, item) => sum + parseFloat(item.price), 0)
    this.setData({ cart, totalPrice: totalPrice.toFixed(2) })
  },
  checkout() { wx.navigateTo({ url: '/pages/shop/checkout/checkout' }) },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) }
})
