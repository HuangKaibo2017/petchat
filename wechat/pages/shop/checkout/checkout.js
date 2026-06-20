Page({
  data: { address: '', totalPrice: '299.00' },
  chooseAddress() {
    wx.chooseAddress({
      success: (res) => {
        this.setData({ address: `${res.provinceName}${res.cityName}${res.countyName} ${res.detailInfo}` })
      }
    })
  },
  submitOrder() {
    if (!this.data.address) return wx.showToast({ title: '请选择地址', icon: 'none' })
    wx.showToast({ title: '支付成功', icon: 'success' })
    setTimeout(() => {
      wx.setStorageSync('cart', [])
      wx.switchTab({ url: '/pages/shop/shop' })
    }, 1500)
  }
})
