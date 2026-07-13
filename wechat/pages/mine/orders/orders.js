const API = require('../../../utils/api')
const { formatTime } = require('../../../utils/util')

Page({
  data: {
    orderList: [],
    activeTab: 'all',
    loading: false,
    statusMap: {
      pending: '待付款',
      paid: '待发货',
      shipped: '待收货',
      completed: '已完成',
      cancelled: '已取消'
    },
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'pending', name: '待付款' },
      { key: 'paid', name: '待发货' },
      { key: 'shipped', name: '待收货' },
      { key: 'completed', name: '已完成' }
    ]
  },

  onShow() {
    this.loadOrders()
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  filterOrders() {
    const { activeTab, orderList } = this.data
    if (activeTab === 'all') return orderList
    return orderList.filter(o => o.status === activeTab)
  },

  async loadOrders() {
    this.setData({ loading: true })
    try {
      const orders = await API.Order.list()
      if (Array.isArray(orders)) {
        this.setData({ orderList: orders })
      } else {
        this.setData({ orderList: [] })
      }
    } catch (err) {
      console.warn('[订单] 加载失败:', err.message || err)
      this.setData({ orderList: [] })
    }
    this.setData({ loading: false })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/mine/orders/orders?id=' + id })
  },

  goShop() {
    wx.switchTab({ url: '/pages/shop/shop' })
  },

  async cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定要取消订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.Order.cancel(id)
            wx.showToast({ title: '已取消', icon: 'success' })
            this.loadOrders()
          } catch (err) {
            wx.showToast({ title: '取消失败', icon: 'none' })
          }
        }
      }
    })
  },

  async confirmReceive(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确认已收到商品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.Order.complete(id)
            wx.showToast({ title: '已确认收货', icon: 'success' })
            this.loadOrders()
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  async payOrder(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    try {
      const payRes = await API.Pay.wechatJsapi(id)
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
      wx.showToast({ title: '支付成功', icon: 'success' })
      this.loadOrders()
    } catch (err) {
      const msg = err && err.errMsg && err.errMsg.indexOf('cancel') >= 0
        ? '已取消支付'
        : (err && err.message) || '支付失败'
      wx.showToast({ title: msg, icon: 'none' })
    }
  }
})
