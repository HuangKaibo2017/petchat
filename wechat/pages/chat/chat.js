const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    pets: [],
    sessions: [],
    loading: false
  },

  onShow() {
    this.loadPets()
    this.loadSessions()
  },

  async loadPets() {
    // 优先从 globalData（已通过 refreshPets 从 API 获取）
    const globalPets = app.globalData.pets
    if (globalPets && globalPets.length > 0) {
      // 检查是否是真实数据（f_id 是数字而非字符串）
      const hasRealData = globalPets.some(p => typeof p.id === 'number' || typeof p.f_id === 'number')
      if (hasRealData) {
        this.setData({ pets: globalPets })
        return
      }
    }
    // globalData 为空或仅有 mock：主动从后端拉取真实宠物（避免用过期缓存 id 建会话失败）
    if (app.refreshPets && wx.getStorageSync('token')) {
      try {
        await app.refreshPets()
        if (app.globalData.pets && app.globalData.pets.length > 0) {
          this.setData({ pets: app.globalData.pets })
          return
        }
      } catch (e) { console.warn('refreshPets 失败:', e) }
    }
    // fallback: localStorage 的 mock 数据
    this.setData({
      pets: wx.getStorageSync('pets') || []
    })
  },

  async loadSessions() {
    this.setData({ loading: true })
    try {
      const res = await API.Chat.listSessions()
      if (res && res.sessions && res.sessions.length) {
        const pets = this.data.pets
        const petMap = {}
        pets.forEach(p => { petMap[String(p.id)] = p })
        this.setData({
          sessions: res.sessions.map(s => ({
            id: s.id || s.f_id,
            petId: s.petId || s.f_pet_id,
            petName: petMap[String(s.petId || s.f_pet_id)]?.name || '宠物',
            lastMessage: s.lastMessage || '',
            time: s.time || s.f_started_at || ''
          }))
        })
      }
    } catch (e) {
      const chatHistory = wx.getStorageSync('chatHistory') || []
      this.setData({ sessions: chatHistory })
    }
    this.setData({ loading: false })
  },

  async startChat(e) {
    const petId = e.currentTarget.dataset.id
    if (!petId) return

    // 检查是否为真实数据库 ID（数字），mock ID 是字符串如 "pet_demo_001"
    const isNumericId = !isNaN(Number(petId)) && String(Number(petId)) === String(petId)
    if (!isNumericId) {
      wx.showToast({ title: '请先在「我的」页面添加宠物', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '创建会话...' })
      const res = await API.Chat.createSession(Number(petId))
      wx.hideLoading()

      // 保存到本地历史
      const chatHistory = wx.getStorageSync('chatHistory') || []
      const exists = chatHistory.find(h => h.petId === petId)
      if (!exists) {
        chatHistory.unshift({
          id: res.sessionId,
          petId,
          petName: this.data.pets.find(p => p.id === petId)?.name || '宠物',
          time: new Date().toLocaleString()
        })
        wx.setStorageSync('chatHistory', chatHistory)
      }

      wx.navigateTo({
        url: `/pages/chat/list/list?sessionId=${res.sessionId}&petId=${petId}`
      })
    } catch (err) {
      wx.hideLoading()
      console.warn('创建会话失败:', err)
      const msg = (err && err.message) || ''
      // 宠物不存在 / 未登录：多半是本地缓存的旧宠物 id 与后端不一致，刷新后重试
      if (msg.includes('宠物') || msg.includes('不存在') || msg === 'UNAUTHORIZED') {
        wx.showToast({ title: '宠物信息已更新，请重新选择', icon: 'none' })
        if (app.refreshPets) { try { await app.refreshPets() } catch (e) {} }
        this.loadPets()
        return
      }
      // 其他错误（如网络不通）才退化为本地离线会话
      const localSessionId = Date.now()
      wx.navigateTo({
        url: `/pages/chat/list/list?sessionId=${localSessionId}&petId=${petId}&local=1`
      })
    }
  },

  openChat(e) {
    const id = e.currentTarget.dataset.id
    const petId = e.currentTarget.dataset['petId'] || e.currentTarget.dataset.petId
    wx.navigateTo({
      url: `/pages/chat/list/list?sessionId=${id}&petId=${petId || ''}`
    })
  },

  goRegister() { wx.navigateTo({ url: '/pages/mine/register/register' }) }
})
