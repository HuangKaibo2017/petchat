const { getProductById } = require('../products')
const API = require('../../../utils/api')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

Page({
  data: {
    product: null,
    loading: true,
    paying: false
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const product = getProductById(options.id)
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
  },

  previewImage(e) {
    const { product } = this.data
    if (!product) return

    wx.previewImage({
      current: e.currentTarget.dataset.image,
      urls: product.images
    })
  },

  async onBuy() {
    const { product } = this.data
    if (!product || this.data.paying) return

    this.setData({ paying: true })
    wx.showLoading({ title: '创建订单...' })

    try {
      const order = await API.Order.create({
        productId: product.id,
        productName: product.displayName || product.name,
        price: product.price,
        quantity: 1
      })

      wx.showLoading({ title: '拉起支付...' })
      const payRes = await API.Pay.wechatJsapi(order.id)
      const payment = payRes.payment || payRes

      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: payment.timeStamp,
          nonceStr: payment.nonceStr,
          package: payment.package,
          signType: payment.signType || 'RSA',
          paySign: payment.paySign,
          success: resolve,
          fail: reject
        })
      })

      wx.showLoading({ title: '确认支付...' })
      let status = null
      for (let i = 0; i < 5; i++) {
        status = await API.Order.paymentStatus(order.id)
        if (status && status.status === 'paid') break
        await sleep(1200)
      }
      wx.hideLoading()

      if (status && status.status === 'paid') {
        wx.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/mine/orders/orders' })
        }, 800)
      } else {
        wx.showToast({ title: '支付处理中，请稍后查看订单', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      const msg = err && err.errMsg && err.errMsg.indexOf('cancel') >= 0
        ? '已取消支付'
        : (err && err.message) || '支付失败'
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  }
})
