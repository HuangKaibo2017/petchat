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
    if (!app.globalData.isAuthorized) return

    this.setData({ loading: true })
    try {
      const res = await API.Chat.listSessions()
      if (res && res.sessions) {
        const pets = this.data.pets
        const petMap = new Map(pets.map(p => [p.id, p]))
        this.setData({
          sessions: res.sessions.map(s => ({
            id: s.f_id,
            petId: s.f_pet_id,
            petName: petMap.get(s.f_pet_id)?.name || '宠物',
            lastActive: s.f_started_at,
            status: s.f_status_session,
          }))
        })
      }
    } catch (e) {
      // Fall back to local storage
      const chatHistory = wx.getStorageSync('chatHistory') || []
      this.setData({ sessions: chatHistory })
    }
    this.setData({ loading: false })
  },

  async startChat(e) {
    const petId = e.currentTarget.dataset.id

    if (!app.globalData.isAuthorized) {
      app.requestAuth(() => this.startChat(e))
      return
    }

    try {
      wx.showLoading({ title: '创建会话...' })
      const res = await API.Chat.createSession(petId)
      wx.hideLoading()

      wx.navigateTo({
        url: `/pages/chat/list/list?sessionId=${res.sessionId}&petId=${petId}`
      })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '创建会话失败', icon: 'none' })
    }
  },

  openChat(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/chat/list/list?sessionId=${id}` })
  },

  goRegister() { wx.navigateTo({ url: '/pages/mine/register/register' }) }
})
