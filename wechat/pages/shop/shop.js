const API = require('../../utils/api')

Page({
  data: {
    activeCategory: 'all',
    cartCount: 0,
    products: [
      { id: 'nfc001', name: '灵犀NFC项圈', desc: '扫码即达·智能身份', price: '299', image: '/images/product-nfc.png', category: 'nfc', shopType: 'self', isFlash: true, flashPrice: '199' },
      { id: 'bead001', name: '合香安神香珠', desc: '舒缓情绪·天然合香', price: '168', image: '/images/product-bead.png', category: 'beads', shopType: 'self' },
      { id: 'bead002', name: '象数水晶·健康款', desc: '能量调理·平衡体质', price: '258', image: '/images/product-crystal.png', category: 'beads', shopType: 'self' },
      { id: 'tag001', name: '智能防丢牌', desc: 'GPS定位·防走失', price: '199', image: '/images/product-tag.png', category: 'nfc', shopType: 'merchant' },
      { id: 'food001', name: '冻干生骨肉·鸡肉味', desc: '高蛋白·无添加', price: '89', image: '/images/product-food.png', category: 'food', shopType: 'self', isGroup: true, groupPrice: '59' },
      { id: 'ins001', name: '宠物医疗险·基础版', desc: '全年保障·直付理赔', price: '299', image: '/images/product-insurance.png', category: 'insurance', shopType: 'self' },
      { id: 'blind001', name: '猫咪惊喜盲盒', desc: '含3-5件随机好物', price: '99', image: '/images/product-bead.png', category: 'blindbox', shopType: 'self' },
      { id: 'supply001', name: '豆腐猫砂6L装', desc: '天然除臭·可冲厕', price: '39', image: '/images/product-food.png', category: 'supplies', shopType: 'merchant', isGroup: true, groupPrice: '25' }
    ]
  },

  onLoad() { this.loadProducts() },
  onShow() {
    const cart = wx.getStorageSync('cart') || []
    this.setData({ cartCount: cart.length })
  },

  async loadProducts() {
    try {
      const res = await API.Product.list()
      const products = Array.isArray(res) ? res : (res?.data || [])
      if (products && products.length > 0) this.setData({ products })
    } catch (e) {}
  },

  switchCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.cat })
  },

  onSearch() { wx.showToast({ title: '搜索功能开发中', icon: 'none' }) },
  goFlash() { wx.showToast({ title: '秒杀专区即将上线', icon: 'none' }) },
  goGroup() { wx.showToast({ title: '拼团专区即将上线', icon: 'none' }) },
  goCoupon() { wx.showToast({ title: '我的优惠券', icon: 'none' }) },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/shop/detail/detail?id=' + e.currentTarget.dataset.id })
  },
  goCart() { wx.navigateTo({ url: '/pages/shop/cart/cart' }) },

  addToCart(e) {
    const item = e.currentTarget.dataset.item
    const cart = wx.getStorageSync('cart') || []
    const exists = cart.find(c => c.id === item.id)
    if (exists) { exists.qty = (exists.qty || 1) + 1 }
    else { cart.push({ ...item, qty: 1 }) }
    wx.setStorageSync('cart', cart)
    this.setData({ cartCount: cart.length })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  }
})