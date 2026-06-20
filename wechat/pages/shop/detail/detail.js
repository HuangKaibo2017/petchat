const API = require('../../../utils/api')

Page({
  data: {
    product: null,
    loading: true
  },

  async onLoad(options) {
    if (!options.id) {
      this.setData({ loading: false })
      wx.showToast({ title: '商品不存在', icon: 'none' })
      return
    }

    try {
      const product = await API.Product.detail(options.id)
      if (product) {
        this.setData({ product, loading: false })
        return
      }
    } catch (e) {
      console.warn('加载商品详情失败:', e)
    }

    // 兜底：本地硬编码商品列表
    const fallbackProducts = [
      { id: 'nfc001', name: '灵犀NFC项圈', desc: '扫码即达·宠物智能身份', price: '299', image: '/images/product-nfc.png' },
      { id: 'bead001', name: '合香安神香珠', desc: '舒缓情绪·天然合香', price: '168', image: '/images/product-bead.png' },
      { id: 'bead002', name: '象数水晶·健康款', desc: '能量调理·平衡体质', price: '258', image: '/images/product-crystal.png' },
      { id: 'tag001', name: '智能防丢牌', desc: 'GPS定位·防走失', price: '199', image: '/images/product-tag.png' },
      { id: 'food001', name: '冻干生骨肉·鸡肉味', desc: '高蛋白·无添加', price: '89', image: '/images/product-food.png' },
      { id: 'ins001', name: '宠物医疗险·基础版', desc: '全年保障·直付理赔', price: '299', image: '/images/product-insurance.png' }
    ]
    const product = fallbackProducts.find(p => p.id === options.id) || fallbackProducts[0]
    this.setData({ product, loading: false })
  },

  addToCart() {
    const product = this.data.product
    if (!product) return
    let cart = wx.getStorageSync('cart') || []
    cart.push({ ...product, cartId: Date.now() })
    wx.setStorageSync('cart', cart)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  buyNow() {
    wx.navigateTo({ url: '/pages/shop/checkout/checkout' })
  },

  goCart() {
    wx.navigateTo({ url: '/pages/shop/cart/cart' })
  }
})
