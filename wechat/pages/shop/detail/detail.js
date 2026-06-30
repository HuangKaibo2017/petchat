const { MockAPI } = require('../../../utils/mock')

Page({
  data: {
    product: null,
    loading: true
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.loadProduct(options.id)
  },

  loadProduct(id) {
    MockAPI.getProductDetail(id).then(res => {
      const product = (res && res.data) ? res.data : null
      if (product) {
        this.setData({ product, loading: false })
      } else {
        wx.showToast({ title: '商品不存在', icon: 'none' })
        this.setData({ loading: false })
        setTimeout(() => wx.navigateBack(), 1500)
      }
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  onBuy() {
    const { product } = this.data
    if (!product) return
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  }
})
