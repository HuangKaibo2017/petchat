const app = getApp()
const API = require('../../../utils/api')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

Page({
  data: {
    cartList: [],
    totalPrice: '0.00',
    selectedAddress: null,
    remark: '',
    paying: false,
    showPay: false,
    orderId: null,
    orderNo: null,
    payAmount: '0.00'
  },

  onShow() {
    this.loadCart()
    this.loadDefaultAddress()
  },

  loadCart() {
    const cartList = app.globalData.cart
    const total = app.getCartTotal()
    this.setData({
      cartList,
      totalPrice: Number(total).toFixed(2)
    })
  },

  loadDefaultAddress() {
    if (this.data.selectedAddress) return
    const addressList = wx.getStorageSync('addressList') || []
    const defaultAddr = addressList.find(a => a.isDefault) || addressList[0] || null
    this.setData({ selectedAddress: defaultAddr })
  },

  onAddressSelected(address) {
    this.setData({ selectedAddress: address })
    wx.setStorageSync('selectedCartAddress', address)
  },

  increase(e) {
    const id = e.currentTarget.dataset.id
    const cart = app.globalData.cart
    const index = cart.findIndex(item => item.id === id)
    if (index > -1) {
      cart[index].count++
      app.globalData.cart = cart
      app.saveCart()
      this.loadCart()
    }
  },

  decrease(e) {
    const id = e.currentTarget.dataset.id
    const cart = app.globalData.cart
    const index = cart.findIndex(item => item.id === id)
    if (index > -1) {
      if (cart[index].count > 1) {
        cart[index].count--
        app.globalData.cart = cart
        app.saveCart()
        this.loadCart()
      } else {
        this.deleteItem(e)
      }
    }
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id
    const cart = app.globalData.cart.filter(item => item.id !== id)
    app.globalData.cart = cart
    app.saveCart()
    this.loadCart()
  },

  goAddress() {
    wx.navigateTo({ url: '/pages/mine/address/address?from=cart' })
  },

  inputRemark(e) {
    this.setData({ remark: e.detail.value })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  async goPay() {
    if (this.data.paying) return

    if (this.data.cartList.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }

    if (!this.data.selectedAddress) {
      wx.showToast({ title: '请先添加收货地址', icon: 'none' })
      return
    }

    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const address = this.data.selectedAddress

    const orderData = {
      products: app.globalData.cart.map(item => ({
        productId: item.id,
        productName: item.name,
        price: item.price,
        quantity: item.count
      })),
      totalAmount: this.data.totalPrice,
      remark: this.data.remark,
      receiverName: address.name,
      receiverPhone: address.phone,
      receiverAddress: (address.region || '') + ' ' + (address.detail || '')
    }

    this.setData({ paying: true })
    wx.showLoading({ title: '创建订单...' })

    try {
      const order = await API.Order.create(orderData)

      wx.showLoading({ title: '拉起支付...' })
      const payRes = await API.Pay.wechatJsapi(order.id || order.orderId)
      const payment = payRes.payment || payRes

      app.globalData.cart = []
      app.saveCart()

      this.setData({
        showPay: true,
        orderId: order.id || order.orderId,
        orderNo: order.orderNo,
        payAmount: this.data.totalPrice,
        cartList: [],
        totalPrice: '0.00',
        remark: ''
      })

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
        status = await API.Order.paymentStatus(order.id || order.orderId)
        if (status && status.status === 'paid') break
        await sleep(1200)
      }
      wx.hideLoading()

      if (status && status.status === 'paid') {
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.setData({ paying: false, showPay: false })
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/mine/orders/orders' })
        }, 800)
      } else {
        wx.showToast({ title: '支付处理中，请稍后查看订单', icon: 'none' })
        this.setData({ paying: false, showPay: false })
      }
    } catch (err) {
      wx.hideLoading()
      const msg = err && err.errMsg && err.errMsg.indexOf('cancel') >= 0
        ? '已取消支付'
        : (err && err.message) || '支付失败'
      wx.showToast({ title: msg, icon: 'none' })
      this.setData({ paying: false })
    }
  },

  wxPay() {
    if (this.data.paying || !this.data.orderId) return
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({ paying: true })
    this.goPay()
  },

  cancelPay() {
    this.setData({ showPay: false, orderId: null, orderNo: null, payAmount: '0.00', paying: false })
  }
})
