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

  loadPets() {
    this.setData({
      pets: app.globalData.pets || wx.getStorageSync('pets') || []
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

    try {
      wx.showLoading({ title: '创建会话...' })
      const res = await API.Chat.createSession(petId)
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
      // 兜底：直接进入聊天
      wx.navigateTo({
        url: `/pages/chat/list/list?petId=${petId}`
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
